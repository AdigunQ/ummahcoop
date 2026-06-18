import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

async function updateMemberStatus(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.APPROVE_MEMBERS))) {
    redirect('/dashboard')
  }

  const userId = String(formData.get('userId') || '')
  const action = String(formData.get('action') || '')

  if (!userId || !['approve', 'reject'].includes(action)) {
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: action === 'approve' ? 'ACTIVE' : 'REJECTED',
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/members')
}

export default async function MembersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.APPROVE_MEMBERS))) {
    redirect('/dashboard')
  }

  const pendingMembers = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      staffId: true,
      email: true,
      phone: true,
      department: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      monthlyContribution: true,
      createdAt: true,
    },
  })

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Member Approvals</h1>
        <p className="text-gray-500 mt-1">
          Review and approve newly registered members.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {pendingMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No pending member requests right now.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingMembers.map((member) => (
              <div key={member.id} className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {member.name || 'Unnamed Member'}
                    </p>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <p className="text-sm text-gray-500">Staff ID: {member.staffId || 'N/A'}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Phone: {member.phone || 'N/A'} · Department:{' '}
                      {member.department || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Bank: {member.bankName || 'N/A'} · {member.bankAccountNumber || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Account Name: {member.bankAccountName || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Monthly Contribution: ₦
                      {(member.monthlyContribution || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {new Date(member.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <form action={updateMemberStatus}>
                      <input type="hidden" name="userId" value={member.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                    </form>

                    <form action={updateMemberStatus}>
                      <input type="hidden" name="userId" value={member.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
