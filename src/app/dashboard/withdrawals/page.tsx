import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import WithdrawalForm from './WithdrawalForm'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { AdminHeading, AdminStats, AdminPanel } from '@/components/admin/admin-ui'
import { AdminCollection, AdminReviewItem } from '@/components/admin/admin-collection'
import { DetailRows } from '@/components/member/account-ui'

export default async function WithdrawalsPage({
  searchParams: searchParamsInput,
}: {
  searchParams?: Promise<{ view?: string }>
}) {
  const searchParams = await searchParamsInput

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const canReview =
    searchParams?.view !== 'member' &&
    (await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.REVIEW_WITHDRAWALS
    ))
  if (canReview) {
    const select = {
      id: true,
      source: true,
      requestedAmount: true,
      approvedAmount: true,
      status: true,
      reason: true,
      requestedAt: true,
      reviewedAt: true,
      payoutBankName: true,
      payoutAccountName: true,
      payoutAccountNumber: true,
      user: { select: { id: true, name: true, staffId: true } },
    } as const
    const [pending, recent] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { status: 'PENDING' },
        orderBy: { requestedAt: 'asc' },
        select,
      }),
      prisma.withdrawal.findMany({
        where: { status: { not: 'PENDING' } },
        orderBy: { reviewedAt: 'desc' },
        take: 50,
        select,
      }),
    ])
    return (
      <div className="admin-page">
        <AdminHeading
          section="Requests"
          title="Withdrawal requests"
          description="Member withdrawal details and recorded outcomes. Viewing a request does not release funds."
        />
        <AdminStats
          items={[
            { label: 'Awaiting review', value: String(pending.length) },
            {
              label: 'Requested amount',
              value: formatCurrency(pending.reduce((sum, row) => sum + row.requestedAmount, 0)),
            },
            {
              label: 'Recent outcomes',
              value: String(recent.length),
              note: 'Latest 50 reviewed requests',
            },
          ]}
        />
        {[
          { title: 'Pending requests', rows: pending },
          { title: 'Recent outcomes', rows: recent },
        ].map(({ title, rows }) => (
          <AdminPanel key={title} title={title}>
            {rows.length ? (
              <AdminCollection>
                {rows.map((request) => (
                  <AdminReviewItem
                    key={request.id}
                    heading={request.user.name || 'Unnamed member'}
                    meta={`Staff ID ${request.user.staffId || 'Not set'}`}
                    status={request.status}
                    amount={formatCurrency(request.requestedAmount)}
                    searchText={`${request.user.name} ${request.user.staffId}`}
                  >
                    <DetailRows
                      rows={[
                        [
                          'Savings account',
                          request.source === 'SPECIAL_SAVINGS'
                            ? 'Special savings'
                            : 'Thrift savings',
                        ],
                        ['Requested', formatCurrency(request.requestedAmount)],
                        [
                          'Approved amount',
                          request.approvedAmount === null
                            ? 'Not recorded'
                            : formatCurrency(request.approvedAmount),
                        ],
                        ['Requested on', formatDateTime(request.requestedAt)],
                        [
                          'Reviewed on',
                          request.reviewedAt
                            ? formatDateTime(request.reviewedAt)
                            : 'Awaiting review',
                        ],
                        ['Bank', request.payoutBankName || 'Not provided'],
                        ['Account name', request.payoutAccountName || 'Not provided'],
                        ['Account number', request.payoutAccountNumber || 'Not provided'],
                      ].map(([label, value]) => ({ label, value }))}
                    />{' '}
                    {request.reason && <p>{request.reason}</p>}
                    <p className="text-xs text-muted-foreground">
                      Request details only. No payout or balance change is made from this view.
                    </p>
                  </AdminReviewItem>
                ))}
              </AdminCollection>
            ) : (
              <p className="admin-empty">No {title.toLowerCase()}.</p>
            )}
          </AdminPanel>
        ))}
      </div>
    )
  }
  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      balance: true,
      specialBalance: true,
      bankName: true,
      bankAccountName: true,
      bankAccountNumber: true,
      withdrawals: {
        orderBy: { requestedAt: 'desc' },
        select: {
          id: true,
          source: true,
          requestedAmount: true,
          approvedAmount: true,
          status: true,
          reason: true,
          requestedAt: true,
          reviewedAt: true,
          payoutBankName: true,
          payoutAccountNumber: true,
          payoutAccountName: true,
        },
      },
    },
  })
  if (!member) redirect('/login')
  const now = new Date()
  return (
    <WithdrawalForm
      member={{
        ...member,
        withdrawals: member.withdrawals.map((request) => ({
          ...request,
          requestedAt: request.requestedAt.toISOString(),
          reviewedAt: request.reviewedAt?.toISOString() ?? null,
        })),
      }}
      isOctober={now.getMonth() === 9}
      nextOctoberYear={now.getMonth() > 9 ? now.getFullYear() + 1 : now.getFullYear()}
    />
  )
}
