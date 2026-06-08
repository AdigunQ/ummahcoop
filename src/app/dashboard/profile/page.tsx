import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProfileView from './ProfileView'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }
  
  if (session.user.role !== 'MEMBER') {
    redirect('/dashboard')
  }

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      staffId: true,
      department: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      createdAt: true,
      totalContributions: true,
    },
  })

  if (!member) redirect('/login')

  const loanRequestSummary = await prisma.loan.aggregate({
    where: { userId: session.user.id },
    _count: { _all: true },
    _sum: { amount: true },
  })

  return (
    <div className="space-y-6">
      <ProfileView
        member={{
          ...member,
          createdAt: member.createdAt.toISOString(),
          loanRequestedAmount: loanRequestSummary._sum.amount ?? 0,
          loanRequestedCount: loanRequestSummary._count._all ?? 0,
        }}
      />
    </div>
  )
}
