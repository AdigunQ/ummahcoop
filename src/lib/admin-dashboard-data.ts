import { prisma } from '@/lib/prisma'
import { getCurrentMemberSnapshot } from '@/lib/current-member-data'

export async function getAdminDashboardData() {
  const [
    snapshot,
    activeLoans,
    pendingMembers,
    pendingPayments,
    pendingLoans,
    recentTransactions,
  ] = await Promise.all([
    getCurrentMemberSnapshot(),
    prisma.loan.count({
      where: { status: 'APPROVED', balance: { gt: 0 } },
    }),
    prisma.user.count({ where: { role: 'MEMBER', status: 'PENDING' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.loan.count({ where: { status: 'PENDING' } }),
    prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
  ])

  const totalMembers = snapshot.dataset.rows.length
  const totalSavings = snapshot.dataset.rows.reduce(
    (sum, row) => sum + row.monthlySavings + row.specialSavings,
    0
  )

  return {
    stats: {
      totalMembers,
      totalSavings,
      activeLoans,
      pendingApprovals: pendingMembers + pendingPayments + pendingLoans,
      pendingMembers,
      pendingPayments,
      pendingLoans,
    },
    recentTransactions,
  }
}
