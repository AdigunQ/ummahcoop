import { AdminSubmit } from '@/components/admin/admin-collection'
import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import { AdminCollection, AdminReviewItem } from '@/components/admin/admin-collection'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

async function reviewPayment(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (
    !session?.user?.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.REVIEW_PAYMENTS
    ))
  ) {
    redirect('/dashboard')
  }

  const paymentId = String(formData.get('paymentId') || '')
  const action = String(formData.get('action') || '')

  if (!paymentId || !['approve', 'reject'].includes(action)) {
    return
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  })

  if (!payment) {
    return
  }

  const approved = action === 'approve'

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: approved ? 'APPROVED' : 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: session.user.name || session.user.email,
      notes: approved
        ? payment.notes || 'Payment verified by admin'
        : payment.notes || 'Payment rejected after review',
    },
  })

  if (approved) {
    const contributionDelta =
      payment.type === 'CONTRIBUTION' ||
      payment.type === 'SAVINGS' ||
      payment.type === 'REGISTRATION'
        ? payment.amount
        : 0

    const loanDelta = payment.type === 'LOAN_REPAYMENT' ? -payment.amount : 0

    await prisma.user.update({
      where: { id: payment.userId },
      data: {
        balance: { increment: contributionDelta },
        totalContributions: { increment: contributionDelta },
        loanBalance: { increment: loanDelta },
      },
    })
  }

  await prisma.transaction.upsert({
    where: { paymentId: payment.id },
    create: {
      userId: payment.userId,
      paymentId: payment.id,
      amount: payment.amount,
      reference: `TRX-${payment.id.slice(-8).toUpperCase()}`,
      type:
        payment.type === 'LOAN_REPAYMENT'
          ? 'LOAN_REPAYMENT'
          : payment.type === 'REGISTRATION'
            ? 'REGISTRATION'
            : payment.type === 'SAVINGS'
              ? 'SAVINGS'
              : 'CONTRIBUTION',
      status: approved ? 'COMPLETED' : 'FAILED',
      description: payment.notes || 'Payment verification update',
    },
    update: {
      status: approved ? 'COMPLETED' : 'FAILED',
      description: payment.notes || 'Payment verification update',
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/transactions')
}

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.REVIEW_PAYMENTS
    ))
  ) {
    redirect('/dashboard')
  }

  const [pendingPayments, reviewedPayments] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            staffId: true,
            department: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: { reviewedAt: 'desc' },
      take: 8,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ])

  return (
    <div className="admin-page">
      <AdminHeading
        section="Requests"
        title="Payment review"
        description={<>Review contributions and repayment submissions in Naira.</>}
      />

      <AdminStats
        items={[
          { label: 'Pending Verifications', value: pendingPayments.length.toString() },
          {
            label: 'Pending Amount',
            value: formatCurrency(
              pendingPayments.reduce((sum, payment) => sum + payment.amount, 0)
            ),
          },
          { label: 'Recently Reviewed', value: reviewedPayments.length.toString() },
        ]}
      />

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Pending Queue</h2>
        </div>

        {pendingPayments.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground">
            No pending payment verifications.
          </div>
        ) : (
          <div className="admin-queue">
            <AdminCollection>
              {pendingPayments.map((payment) => (
                <AdminReviewItem
                  key={payment.id}
                  heading={payment.user?.name || 'Unnamed member'}
                  meta={payment.type.replaceAll('_', ' ')}
                  status={payment.status}
                  amount={formatCurrency(payment.amount)}
                  searchText={
                    (payment.user?.name || '') +
                    ' ' +
                    payment.type.replaceAll('_', ' ') +
                    ' ' +
                    (payment.user?.email || '') +
                    ' ' +
                    (payment.user?.staffId || '')
                  }
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {payment.user?.name || 'Unknown Member'}
                      </p>
                      <p className="text-sm text-muted-foreground">{payment.user?.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.user?.department || 'N/A'} · {payment.type.replace('_', ' ')}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Submitted: {formatDateTime(payment.date)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Reference: {payment.transactionReference || 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Proof:{' '}
                        {payment.proofImage ? (
                          <a
                            href={payment.proofImage}
                            target="_blank"
                            className="text-primary-600 hover:underline"
                            rel="noreferrer"
                          >
                            View proof
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Amount:{' '}
                        <span className="text-foreground">{formatCurrency(payment.amount)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Date received: {formatDateTime(payment.createdAt)}
                      </p>
                      {payment.notes && (
                        <p className="mt-1 text-sm text-muted-foreground">{payment.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <form action={reviewPayment}>
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <input type="hidden" name="action" value="approve" />
                        <AdminSubmit pendingLabel="Processing..."
                          className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                        >
                          Approve
                        </AdminSubmit>
                      </form>

                      <form action={reviewPayment}>
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <input type="hidden" name="action" value="reject" />
                        <AdminSubmit pendingLabel="Processing..."
                          className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                        >
                          Reject
                        </AdminSubmit>
                      </form>
                    </div>
                  </div>
                </AdminReviewItem>
              ))}
            </AdminCollection>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Recently Reviewed</h2>
        </div>

        {reviewedPayments.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground">
            No reviewed payments yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reviewedPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-2 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {payment.user?.name || 'Unknown Member'}
                  </p>
                  <p className="text-muted-foreground">
                    {payment.type.replace('_', ' ')} · {formatCurrency(payment.amount)}
                  </p>
                  <p className="text-muted-foreground">
                    Verified by: {payment.reviewedBy || 'N/A'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {payment.reviewedAt
                      ? `Verification date: ${formatDateTime(payment.reviewedAt)}`
                      : '-'}
                  </span>
                  <StatusBadge status={payment.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-surface-2 text-foreground'}`}
    >
      {status}
    </span>
  )
}
