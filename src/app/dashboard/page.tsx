import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminAnalytics } from '@/components/dashboard/admin-analytics'
import { MemberDashboard } from '@/components/dashboard/member-dashboard'
import { getMemberFinanceSummary } from '@/lib/member-finance'
import { getLoanLimit } from '@/lib/loan-request'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { view?: string }
}) {
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

  if (grantedAccessCount > 0 && searchParams?.view !== 'member') {
    return <AdminAnalytics canSwitchToMember />
  }

  // Select only the fields this page needs so older deployments can still
  // render while additive profile migrations are being applied.
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      staffId: true,
      department: true,
      createdAt: true,
      balance: true,
      specialBalance: true,
      totalContributions: true,
      loanBalance: true,
      monthlyContribution: true,
      specialContribution: true,
    },
  })

  if (!user) {
    redirect('/login')
  }

  const [recentPayments, recentLoans, recentCommodities] = await Promise.all([
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.loan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        purpose: true,
        duration: true,
        amount: true,
        status: true,
      },
    }),
    prisma.commodityRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        itemCategory: true,
        itemModel: true,
        status: true,
        createdAt: true,
      },
    }),
  ])

  const financeSummary = await getMemberFinanceSummary(user.id, user.staffId)

  // Member dashboard data
  const loanEligibility = getLoanLimit(user.balance)
  const displayedLoanBalance =
    financeSummary.loanPrincipal > 0
      ? financeSummary.loanOutstanding
      : Math.max(user.loanBalance, financeSummary.loanOutstanding)
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
    loanBalance: displayedLoanBalance,
    monthlyContribution: user.monthlyContribution,
    specialContribution: user.specialContribution,
  }

  return (
    <MemberDashboard
      user={memberProfile}
      loanEligibility={loanEligibility}
      loanSummary={{
        approvedCount: financeSummary.loanCount,
        approvedAmount: financeSummary.loanCollected,
        paidAmount: financeSummary.loanPaid,
        outstandingAmount: financeSummary.loanOutstanding,
        repaymentStartPeriod: financeSummary.loanRepaymentStartPeriod,
      }}
      commoditySummary={financeSummary}
      recentPayments={recentPayments}
      recentLoans={recentLoans}
      recentCommodities={recentCommodities}
    />
  )
}
