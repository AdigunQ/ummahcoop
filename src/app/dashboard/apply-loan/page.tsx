import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { differenceInMonths } from 'date-fns'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LOAN_POLICY } from '@/lib/constants'
import { LoanRequestForm } from './LoanRequestForm'

export default async function ApplyLoanPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || session.user.role !== 'MEMBER' || !session.user.id) {
    redirect('/login')
  }

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      staffId: true,
      department: true,
      bankName: true,
      bankAccountName: true,
      bankAccountNumber: true,
      createdAt: true,
      status: true,
      balance: true,
      specialBalance: true,
      monthlyContribution: true,
      loanBalance: true,
      loans: {
        where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'] } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          amount: true,
          duration: true,
          purpose: true,
          status: true,
          createdAt: true,
          interestRate: true,
          totalRepayable: true,
        },
      },
    },
  })

  if (!member) {
    redirect('/login')
  }

  const monthsServed = Math.max(0, differenceInMonths(new Date(), member.createdAt))
  const loanEligibility = member.balance * LOAN_POLICY.maxSavingsMultiplier
  const hasBankDetails = Boolean(member.bankName && member.bankAccountName && member.bankAccountNumber)
  const canSubmit = member.status === 'ACTIVE' && monthsServed >= 6 && member.loanBalance <= 0 && member.loans.filter((loan) => loan.status === 'PENDING').length === 0

  return (
    <LoanRequestForm
      member={{
        name: member.name,
        email: member.email,
        phone: member.phone,
        staffId: member.staffId,
        department: member.department,
        bankName: member.bankName,
        bankAccountName: member.bankAccountName,
        bankAccountNumber: member.bankAccountNumber,
        balance: member.balance,
        specialBalance: member.specialBalance,
        monthlyContribution: member.monthlyContribution,
        createdAt: member.createdAt.toISOString(),
        status: member.status,
      }}
      recentLoans={member.loans.map((loan) => ({
        id: loan.id,
        amount: loan.amount,
        duration: loan.duration,
        purpose: loan.purpose,
        status: loan.status,
        createdAt: loan.createdAt.toISOString(),
        interestRate: loan.interestRate,
        totalRepayable: loan.totalRepayable,
      }))}
      loanEligibility={loanEligibility}
      monthsServed={monthsServed}
      canSubmit={canSubmit}
      hasBankDetails={hasBankDetails}
    />
  )
}
