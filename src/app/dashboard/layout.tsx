import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { autoPostMonthEndIfDue } from '@/lib/payroll'
import { getUserPrivilegeCodes } from '@/lib/access'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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

  let monthEndIssue = false
  if (user.role === 'ADMIN') {
    try {
      await autoPostMonthEndIfDue()
    } catch (error) {
      console.error('[dashboard-layout] month-end processing unavailable', error)
      monthEndIssue = true
    }
  }

  const canSeeAdminBadges = user.role === 'ADMIN' || privilegeCount > 0

  let adminBadges:
    | { pendingMembers: number; pendingPayments: number; pendingLoans: number; pendingSavingsChanges: number }
    | undefined
  if (canSeeAdminBadges) {
    try {
      const [pendingMembers, pendingPayments, pendingLoans, pendingSavingsChanges] = await Promise.all([
        prisma.user.count({ where: { role: 'MEMBER', status: 'PENDING' } }),
        prisma.payment.count({ where: { status: 'PENDING' } }),
        prisma.loan.count({ where: { status: 'PENDING' } }),
        prisma.savingsChangeRequest.count({ where: { status: 'PENDING' } }),
      ])
      adminBadges = { pendingMembers, pendingPayments, pendingLoans, pendingSavingsChanges }
    } catch (error) {
      console.error('[dashboard-layout] admin badges unavailable', error)
    }
  }

  return (
    <div className="workspace">
      <DashboardNav
        user={{
          ...user,
          privileges: privilegeCodes.map((code) => ({ code })),
        }}
        adminBadges={adminBadges}
      />
      <main className="workspace-main">
        <div id="workspace-content" className="workspace-content" tabIndex={-1}>
          {monthEndIssue && (
            <p role="alert" className="card mb-5 p-4 text-sm">
              Automatic month-end processing could not finish.{' '}
              <Link href="/dashboard/month-end" className="font-semibold underline">
                Review month-end status
              </Link>{' '}
              before posting again.
            </p>
          )}
          <div className="animate-fadeIn">{children}</div>
        </div>
      </main>
    </div>
  )
}
