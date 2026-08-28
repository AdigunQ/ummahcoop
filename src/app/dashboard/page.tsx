import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminAnalytics } from '@/components/dashboard/admin-analytics'
import { MemberDashboard } from '@/components/dashboard/member-dashboard'
import { getMemberFinanceSummary } from '@/lib/member-finance'
import { getLoanLimit } from '@/lib/loan-request'

type RecentCommodity = {
  id: string
  itemCategory: string | null
  itemModel: string | null
  status: string
  createdAt: Date
}

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

  let grantedAccessCount = 0
  if (session.user?.id) {
    try {
      grantedAccessCount = await prisma.memberPrivilege.count({ where: { userId: session.user.id } })
    } catch (error) {
      console.error('[dashboard] privilege lookup unavailable', error)
    }
  }

  if (grantedAccessCount > 0 && searchParams?.view !== 'member') {
    return <AdminAnalytics canSwitchToMember />
  }

  // Select only the fields this page needs so older deployments can still
  // render while additive profile migrations are being applied.
  type DashboardUser = {
    id: string
    name: string | null
    email: string
    status: string
    staffId: string | null
    department: string | null
    createdAt: Date
    balance: number
    specialBalance: number
    totalContributions: number
    loanBalance: number
    monthlyContribution: number | null
    specialContribution: number | null
  }

  let user: DashboardUser | null = null
  try {
    user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error('[dashboard] member profile lookup unavailable', error)
  }

  // A valid auth session is enough to show the member shell during a short
  // database/schema outage. Fresh financial data is still loaded when it is
  // available, while the page remains usable instead of returning HTTP 500.
  user ||= {
    id: session.user?.id || email,
    name: session.user?.name || null,
    email,
    status: session.user?.status || 'ACTIVE',
    staffId: null,
    department: null,
    createdAt: new Date(),
    balance: 0,
    specialBalance: 0,
    totalContributions: 0,
    loanBalance: 0,
    monthlyContribution: null,
    specialContribution: null,
  }

  let recentPayments: Array<Record<string, unknown>> = []
  let recentLoans: Array<Record<string, unknown>> = []
  let recentCommodities: RecentCommodity[] = []
  try {
    ;[recentPayments, recentLoans, recentCommodities] = await Promise.all([
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
  } catch (error) {
    console.error('[dashboard] recent activity unavailable', error)
  }

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
