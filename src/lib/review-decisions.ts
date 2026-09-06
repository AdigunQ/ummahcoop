import type { Loan, Payment } from '@prisma/client'
import { prisma } from './prisma'
import { LOAN_REQUEST_POLICY } from './loan-request'

export async function saveLoanDecision(loan: Loan, approved: boolean, reviewerId: string) {
  const chargeRate = loan.interestRate || LOAN_REQUEST_POLICY.adminChargePercent
  const totalRepayable = loan.amount + loan.amount * (chargeRate / 100)

  return prisma.$transaction(async (tx) => {
    // Claim a pending request once. All financial writes roll back together.
    const claimed = await tx.loan.updateMany({
      where: { id: loan.id, status: 'PENDING' },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedBy: reviewerId,
        approvedAt: new Date(),
        totalRepayable,
        monthlyPayment: totalRepayable / loan.duration,
        balance: approved ? totalRepayable : 0,
        notes: approved
          ? `Loan approved with ${chargeRate}% admin charge. Repayment will be deducted monthly.`
          : 'Loan request declined after review.',
      },
    })
    if (!claimed.count) return false
    if (!approved) return true

    const member = await tx.user.updateMany({
      where: {
        id: loan.userId,
        status: 'ACTIVE',
        loanBalance: { lte: 0 },
        balance: { gte: loan.amount / LOAN_REQUEST_POLICY.maxSavingsMultiplier },
      },
      data: { loanBalance: { increment: totalRepayable } },
    })
    if (member.count !== 1) {
      throw new Error('Member eligibility changed. Refresh the request before reviewing again.')
    }
    await tx.transaction.create({
      data: {
        userId: loan.userId,
        type: 'LOAN_DISBURSEMENT',
        amount: loan.amount,
        status: 'COMPLETED',
        reference: `TRX-LOAN-${loan.id}`,
        description: `Loan approved: ${loan.purpose}`,
      },
    })
    return true
  })
}

export async function savePaymentDecision(payment: Payment, approved: boolean, reviewer: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: reviewer,
        notes: payment.notes || (approved ? 'Payment verified by admin' : 'Payment rejected after review'),
      },
    })
    if (!claimed.count) return false

    if (approved) {
      const contributionDelta = ['CONTRIBUTION', 'SAVINGS', 'REGISTRATION'].includes(payment.type)
        ? payment.amount
        : 0
      await tx.user.update({
        where: { id: payment.userId },
        data: {
          balance: { increment: contributionDelta },
          totalContributions: { increment: contributionDelta },
          loanBalance: { increment: payment.type === 'LOAN_REPAYMENT' ? -payment.amount : 0 },
        },
      })
    }
    await tx.transaction.upsert({
      where: { paymentId: payment.id },
      create: {
        userId: payment.userId,
        paymentId: payment.id,
        amount: payment.amount,
        reference: `TRX-${payment.id}`,
        type: payment.type,
        status: approved ? 'COMPLETED' : 'FAILED',
        description: payment.notes || 'Payment verification update',
      },
      update: {
        status: approved ? 'COMPLETED' : 'FAILED',
        description: payment.notes || 'Payment verification update',
      },
    })
    return true
  })
}
