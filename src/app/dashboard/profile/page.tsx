import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProfileView from './ProfileView'

type SearchParams = {
  password?: string
}

function compactStaffId(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
}

async function mustChangeInitialPassword(member: { staffId: string | null; password: string | null }) {
  if (!member.staffId) return false
  if (!member.password) return true

  return bcrypt.compare(compactStaffId(member.staffId), member.password)
}

export default async function ProfilePage({ searchParams }: { searchParams?: SearchParams }) {
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
      password: true,
    },
  })

  if (!member) redirect('/login')
  const { password, ...profileMember } = member
  const mustChangePassword = searchParams?.password === 'required' || await mustChangeInitialPassword({ staffId: member.staffId, password })

  const loanRequestSummary = await prisma.loan.aggregate({
    where: { userId: session.user.id },
    _count: { _all: true },
    _sum: { amount: true },
  })

  return (
    <div className="space-y-6">
      <ProfileView
        member={{
          ...profileMember,
          createdAt: profileMember.createdAt.toISOString(),
          loanRequestedAmount: loanRequestSummary._sum.amount ?? 0,
          loanRequestedCount: loanRequestSummary._count._all ?? 0,
        }}
        mustChangePassword={mustChangePassword}
      />
    </div>
  )
}
