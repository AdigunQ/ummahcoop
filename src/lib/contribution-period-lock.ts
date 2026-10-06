import type { Prisma } from '@prisma/client'

export async function lockContributionPeriod(tx: Prisma.TransactionClient, period: string) {
  // Review and payroll preparation must not race using different monthly plans.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`ummah-contributions:${period}`}))::text`
}
