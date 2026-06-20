import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard/nav'
import { prisma } from '@/lib/prisma'
import { autoPostMonthEndIfDue } from '@/lib/payroll'

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

  // Get fresh user data
  const user = await prisma.user.findUnique({
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
      privileges: {
        select: {
          code: true,
        },
      },
    },
  })

  if (!user) {
    redirect('/login')
  }

  if (user.role === 'ADMIN') {
    await autoPostMonthEndIfDue()
  }

  const canSeeAdminBadges =
    user.role === 'ADMIN' || (user.privileges?.length || 0) > 0

  const adminBadges = canSeeAdminBadges
    ? await (async () => {
        const [pendingMembers, pendingPayments, pendingLoans] = await Promise.all([
          prisma.user.count({ where: { role: 'MEMBER', status: 'PENDING' } }),
          prisma.payment.count({ where: { status: 'PENDING' } }),
          prisma.loan.count({ where: { status: 'PENDING' } }),
        ])

        return { pendingMembers, pendingPayments, pendingLoans }
      })()
    : undefined

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} adminBadges={adminBadges} />
      <main className="min-h-screen lg:ml-72">
        <div className="px-4 pb-10 pt-20 lg:px-8 lg:pt-10">
          <div className="mx-auto max-w-6xl animate-fadeIn">{children}</div>
        </div>
      </main>
    </div>
  )
}
