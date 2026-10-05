import { AdminSubmit } from '@/components/admin/admin-collection'
import { AdminHeading } from '@/components/admin/admin-ui'
import { AdminCollection, AdminReviewItem } from '@/components/admin/admin-collection'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { UserCheck, Check, X, CalendarDays, PiggyBank, Wallet } from 'lucide-react'
import { PageHeading, StatusBadge, EmptyState } from '@/components/ui/overview'
import { formatCurrency, getInitials, formatDate } from '@/lib/utils'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

async function updateMemberStatus(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (
    !session?.user?.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.APPROVE_MEMBERS
    ))
  ) {
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
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/members')
  revalidatePath('/dashboard/member-data')
  revalidatePath('/dashboard/analytics')
  revalidatePath('/dashboard/directory')
  revalidatePath('/dashboard/vouchers')
  revalidatePath('/dashboard/finance-report')
}

export default async function MembersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.APPROVE_MEMBERS
    ))
  ) {
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
      savingsPlan: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      monthlyContribution: true,
      specialContribution: true,
      createdAt: true,
    },
  })

  return (
    <div className="admin-page">
      <AdminHeading
        section="Requests"
        title="Membership approvals"
        description="Review the people joining your cooperative and their chosen savings plans."
        actions={
          <span className="status-badge tone-amber">{pendingMembers.length} awaiting review</span>
        }
      />
      {!pendingMembers.length ? (
        <section className="card">
          <EmptyState
            icon={<UserCheck className="h-5 w-5" />}
            title="You are all caught up"
            description="New membership applications will appear here for your review."
          />
        </section>
      ) : (
        <div className="admin-queue">
          <AdminCollection>
            {pendingMembers.map((member) => (
              <AdminReviewItem
                key={member.id}
                heading={member.name || 'Unnamed member'}
                meta={'Staff ID ' + (member.staffId || 'Not set')}
                status={'PENDING'}
                amount={formatCurrency(
                  (member.monthlyContribution || 0) + (member.specialContribution || 0)
                )}
                searchText={
                  (member.name || '') +
                  ' ' +
                  ('Staff ID ' + (member.staffId || 'Not set')) +
                  ' ' +
                  (member.staffId || '')
                }
              >
                <div className="flex items-center gap-3 p-6">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                    {getInitials(member.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">{member.name || 'Unnamed member'}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Staff ID {member.staffId || 'Not set'}
                    </p>
                  </div>
                  <StatusBadge status="PENDING" />
                </div>
                <div className="mx-6 grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PiggyBank className="h-3.5 w-3.5" /> Thrift / month
                    </p>
                    <p className="number-value mt-2 text-xl font-semibold">
                      {formatCurrency(member.monthlyContribution || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" /> Special / month
                    </p>
                    <p className="number-value mt-2 text-xl font-semibold">
                      {formatCurrency(member.specialContribution || 0)}
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Applied {formatDate(member.createdAt)}{' '}
                    ·{' '}
                    {member.savingsPlan === 'BOTH'
                      ? 'Both savings plans'
                      : member.savingsPlan === 'THRIFT'
                        ? 'Thrift savings'
                        : member.savingsPlan === 'SPECIAL'
                          ? 'Special savings'
                          : 'No plan selected'}
                  </p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-accent">
                      Contact and bank details
                    </summary>
                    <dl className="mt-3 space-y-2 text-xs">
                      {[
                        ['Phone', member.phone],
                        ['Department', member.department],
                        ['Email', member.email],
                        ['Bank', member.bankName],
                        ['Account number', member.bankAccountNumber],
                        ['Account name', member.bankAccountName],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="break-all text-right">{value || 'Not provided'}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </div>
                <div className="flex justify-end gap-2 border-t px-6 py-4">
                  <form action={updateMemberStatus}>
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="action" value="reject" />
                    <AdminSubmit pendingLabel="Processing..." className="btn-ghost !min-h-10 !py-2 !text-xs">
                      <X className="h-3.5 w-3.5" /> Reject
                    </AdminSubmit>
                  </form>
                  <form action={updateMemberStatus}>
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="action" value="approve" />
                    <AdminSubmit pendingLabel="Processing..." className="btn-primary !min-h-10 !py-2 !text-xs">
                      <Check className="h-3.5 w-3.5" /> Approve membership
                    </AdminSubmit>
                  </form>
                </div>
              </AdminReviewItem>
            ))}
          </AdminCollection>
        </div>
      )}
    </div>
  )
}
