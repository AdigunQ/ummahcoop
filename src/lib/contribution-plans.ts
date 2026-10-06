import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { savingsPeriod, savingsPlanName } from '@/lib/savings-change-policy'

export async function getApprovedSavingsPlans(
  period: string,
  userIds?: string[],
  afterPeriod?: string,
  db: Pick<Prisma.TransactionClient, 'savingsChangeRequest'> = prisma
) {
  if (userIds?.length === 0) return new Map<string, { requestedThrift: number; requestedSpecial: number }>()
  const changes = await db.savingsChangeRequest.findMany({
    where: {
      status: 'APPROVED',
      ...(userIds ? { userId: { in: userIds } } : {}),
      effectivePeriod: { lte: period, ...(afterPeriod ? { gt: afterPeriod } : {}) },
    },
    orderBy: [{ effectivePeriod: 'desc' }, { reviewedAt: 'desc' }],
    select: { userId: true, requestedThrift: true, requestedSpecial: true },
  })
  const plans = new Map<string, { requestedThrift: number; requestedSpecial: number }>()
  for (const change of changes) if (!plans.has(change.userId)) plans.set(change.userId, change)
  return plans
}

export async function resolveContributionPlans<T extends { id: string; monthlyContribution?: number | null; specialContribution?: number | null }>(
  members: T[], period = savingsPeriod(), db: Pick<Prisma.TransactionClient, 'savingsChangeRequest'> = prisma
): Promise<T[]> {
  const plans = await getApprovedSavingsPlans(period, members.map(member => member.id), undefined, db)
  return members.map(member => {
    const plan = plans.get(member.id)
    return plan ? { ...member, monthlyContribution: plan.requestedThrift, specialContribution: plan.requestedSpecial,
      savingsPlan: savingsPlanName(plan.requestedThrift, plan.requestedSpecial) } : member
  })
}
