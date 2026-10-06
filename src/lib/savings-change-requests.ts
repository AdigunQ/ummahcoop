import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveContributionPlans } from '@/lib/contribution-plans'
import { parseSavingsChangePlan, savingsPeriod, validateSavingsPeriod } from '@/lib/savings-change-policy'
import { lockContributionPeriod } from '@/lib/contribution-period-lock'

async function activeMember(tx: Prisma.TransactionClient, userId: string) {
  const member = await tx.user.findUnique({ where: { id: userId }, select: {
    id: true, role: true, status: true, monthlyContribution: true, specialContribution: true,
  } })
  if (!member || member.role !== 'MEMBER' || member.status !== 'ACTIVE') throw new Error('Only approved, active members can request savings changes.')
  return member
}

async function requireReviewer(tx: Prisma.TransactionClient, reviewerId: string) {
  const reviewer = await tx.user.findUnique({ where: { id: reviewerId }, select: { role: true, status: true } })
  if (!reviewer || reviewer.status !== 'ACTIVE') throw new Error('You do not have permission to review savings changes.')
  if (reviewer.role !== 'ADMIN' && !await tx.memberPrivilege.findUnique({ where: { userId_code: { userId: reviewerId, code: 'EDIT_MEMBERS' } } })) {
    throw new Error('You do not have permission to review savings changes.')
  }
}

async function requireOpenPeriod(tx: Prisma.TransactionClient, period: string, now: Date) {
  validateSavingsPeriod(period, now)
  const latest = await tx.memberDataMonth.findFirst({ orderBy: { period: 'desc' }, select: { period: true } })
  if (latest && period <= latest.period) throw new Error(`Choose a month after ${latest.period}; existing uploaded records are preserved.`)
  if (await tx.payrollCycle.findUnique({ where: { period }, select: { id: true } })) {
    throw new Error('Payroll has already been prepared for that month. Choose a later month.')
  }
}

function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
}

export async function requestSavingsChange(userId: string, input: {
  thrift: unknown; special: unknown; requestedPeriod: string; reason?: string
}, now = new Date()) {
  const { thrift, special } = parseSavingsChangePlan(input.thrift, input.special)
  const reason = (input.reason || '').trim()
  if (reason.length > 1000) throw new Error('Keep the reason under 1,000 characters.')
  return serializable(async tx => {
    const member = await activeMember(tx, userId)
    await requireOpenPeriod(tx, input.requestedPeriod, now)
    if (await tx.savingsChangeRequest.findFirst({ where: { userId, OR: [
      { status: 'PENDING' }, { status: 'APPROVED', effectivePeriod: { gt: savingsPeriod(now) } },
    ] } })) throw new Error('You already have a pending or scheduled change. Wait for it to take effect, or cancel a pending request first.')
    const [current] = await resolveContributionPlans([member], savingsPeriod(now), tx)
    if (thrift === (current.monthlyContribution || 0) && special === (current.specialContribution || 0)) throw new Error('Enter an amount different from your current monthly plan.')
    return tx.savingsChangeRequest.create({ data: {
      userId, previousThrift: current.monthlyContribution || 0, previousSpecial: current.specialContribution || 0,
      requestedThrift: thrift, requestedSpecial: special, requestedPeriod: input.requestedPeriod, reason: reason || null,
    } })
  })
}

export async function cancelSavingsChange(userId: string, requestId: string) {
  return serializable(async tx => {
    await activeMember(tx, userId)
    const result = await tx.savingsChangeRequest.updateMany({ where: { id: requestId, userId, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    if (result.count !== 1) throw new Error('This request has already been reviewed or cancelled, or does not belong to you.')
  })
}

export async function reviewSavingsChange(reviewerId: string, input: {
  requestId: string; decision: string; effectivePeriod: string; note?: string
}, now = new Date()) {
  if (!['approve', 'reject'].includes(input.decision)) throw new Error('Choose approve or reject.')
  const note = (input.note || '').trim()
  if (note.length > 1000) throw new Error('Keep the review note under 1,000 characters.')
  return prisma.$transaction(async tx => {
    if (input.decision === 'approve') {
      validateSavingsPeriod(input.effectivePeriod, now)
      await lockContributionPeriod(tx, input.effectivePeriod)
    }
    await requireReviewer(tx, reviewerId)
    const request = await tx.savingsChangeRequest.findUnique({ where: { id: input.requestId } })
    if (!request || request.status !== 'PENDING') throw new Error('This request has already been reviewed or cancelled.')
    if (request.userId === reviewerId) throw new Error('Another authorised admin must review your own savings change.')
    if (input.decision === 'approve') {
      parseSavingsChangePlan(request.requestedThrift, request.requestedSpecial)
      await activeMember(tx, request.userId)
      await requireOpenPeriod(tx, input.effectivePeriod, now)
      if (input.effectivePeriod < request.requestedPeriod) throw new Error('The effective month cannot be earlier than the month requested by the member.')
      if (await tx.savingsChangeRequest.findFirst({ where: {
        userId: request.userId, status: 'APPROVED', effectivePeriod: { gt: savingsPeriod(now) },
      } })) throw new Error('This member already has a scheduled change.')
    }
    const result = await tx.savingsChangeRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: {
      status: input.decision === 'approve' ? 'APPROVED' : 'REJECTED',
      effectivePeriod: input.decision === 'approve' ? input.effectivePeriod : null,
      reviewedById: reviewerId, reviewedAt: now, reviewNote: note || null,
    } })
    if (result.count !== 1) throw new Error('This request was just reviewed. Refresh the page.')
    // Approval schedules a plan only. It never rewrites balances, vouchers or uploaded sheets.
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 })
}
