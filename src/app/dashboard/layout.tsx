import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { autoPostMonthEndIfDue } from '@/lib/payroll'
import { getMemberFinanceSummary } from '@/lib/member-finance'
import { getUserPrivilegeCodes } from '@/lib/access'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email

  if (!email && !session?.user?.id) {
    redirect('/login')
  }

  // Get fresh user data, but do not turn a temporary database/schema issue
  // into a failed login page when the auth session is still valid.
  type DashboardUser = {
    id: string
    name: string | null
    email: string
    staffId: string | null
    role: string
    status: string
    balance: number
    loanBalance: number
  }

  let user: DashboardUser | null = null
  try {
    user = await prisma.user.findUnique({
      where: session?.user?.id ? { id: session.user.id } : { email: email as string },
      select: {
        id: true,
        name: true,
        email: true,
        staffId: true,
        role: true,
        status: true,
        balance: true,
        loanBalance: true,
      },
    })
  } catch (error) {
    console.error('[dashboard-layout] user lookup unavailable', error)
  }

  user ||= {
    id: session.user?.id || email || 'member-session',
    name: session.user?.name || null,
    email: email || '',
    staffId: null,
    role: session.user?.role || 'MEMBER',
    status: session.user?.status || 'ACTIVE',
    balance: 0,
    loanBalance: 0,
  }

  let privilegeCount = 0
  let privilegeCodes: string[] = []
  if (user.role === 'MEMBER') {
    try {
      privilegeCodes = await getUserPrivilegeCodes(user.id)
      privilegeCount = privilegeCodes.length
    } catch (error) {
      console.error('[dashboard-layout] privilege lookup unavailable', error)
    }
  }

  if (user.role === 'ADMIN') {
    await autoPostMonthEndIfDue()
  }

  const navLoanBalance = user.role === 'MEMBER'
    ? Math.max(user.loanBalance, (await getMemberFinanceSummary(user.id, user.staffId)).loanOutstanding)
    : user.loanBalance

  const canSeeAdminBadges =
    user.role === 'ADMIN' || privilegeCount > 0

  let adminBadges: { pendingMembers: number; pendingPayments: number; pendingLoans: number } | undefined
  if (canSeeAdminBadges) {
    try {
      const [pendingMembers, pendingPayments, pendingLoans] = await Promise.all([
        prisma.user.count({ where: { role: 'MEMBER', status: 'PENDING' } }),
        prisma.payment.count({ where: { status: 'PENDING' } }),
        prisma.loan.count({ where: { status: 'PENDING' } }),
      ])
      adminBadges = { pendingMembers, pendingPayments, pendingLoans }
    } catch (error) {
      console.error('[dashboard-layout] admin badges unavailable', error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        user={{
          ...user,
          loanBalance: navLoanBalance,
          privileges: privilegeCodes.map((code) => ({ code })),
        }}
        adminBadges={adminBadges}
      />
      <main className="min-h-screen lg:ml-72">
        <div className="px-4 pb-10 pt-20 lg:px-8 lg:pt-10">
          <div className="mx-auto max-w-6xl animate-fadeIn">{children}</div>
        </div>
      </main>
    </div>
  )
}
