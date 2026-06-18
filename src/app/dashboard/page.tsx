import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminAnalytics } from '@/components/dashboard/admin-analytics'
import { MemberDashboard } from '@/components/dashboard/member-dashboard'
import { LOAN_POLICY } from '@/lib/constants'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email

  if (!email) {
    redirect('/login')
  }

  if (session.user?.role === 'ADMIN') {
    return <AdminAnalytics />
  }

  const grantedAccessCount = session.user?.id
    ? await prisma.memberPrivilege.count({ where: { userId: session.user.id } })
    : 0

  if (grantedAccessCount > 0) {
    return <AdminAnalytics />
  }

  // Get member data
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      loans: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!user) {
    redirect('/login')
  }

  const approvedLoanSummary = await prisma.loan.aggregate({
    where: {
      userId: user.id,
      status: 'APPROVED',
    },
    _count: {
      _all: true,
    },
    _sum: {
      amount: true,
    },
  })

  // Member dashboard data
  const loanEligibility = user.balance * LOAN_POLICY.maxSavingsMultiplier
  const memberProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    staffId: user.staffId,
    department: user.department,
    createdAt: user.createdAt.toISOString(),
    balance: user.balance,
    specialBalance: user.specialBalance,
    totalContributions: user.totalContributions,
    loanBalance: user.loanBalance,
    monthlyContribution: user.monthlyContribution,
    specialContribution: user.specialContribution,
  }

  return (
    <MemberDashboard
      user={memberProfile}
      loanEligibility={loanEligibility}
      loanSummary={{
        approvedCount: approvedLoanSummary._count._all || 0,
        approvedAmount: approvedLoanSummary._sum.amount || 0,
      }}
      recentPayments={user.payments}
      recentLoans={user.loans}
    />
  )
}
