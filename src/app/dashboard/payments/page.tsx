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
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.REVIEW_PAYMENTS))) {
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
        ? (payment.notes || 'Payment verified by admin')
        : (payment.notes || 'Payment rejected after review'),
    },
  })

  if (approved) {
    const contributionDelta =
      payment.type === 'CONTRIBUTION' || payment.type === 'SAVINGS' || payment.type === 'REGISTRATION'
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

  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.REVIEW_PAYMENTS))) {
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
    <div className="animate-fadeIn space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payment Verifications</h1>
        <p className="mt-1 text-gray-500">Review contributions and repayment submissions in Naira.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Pending Verifications" value={pendingPayments.length.toString()} tone="amber" />
        <MetricCard
          label="Pending Amount"
          value={formatCurrency(pendingPayments.reduce((sum, payment) => sum + payment.amount, 0))}
          tone="blue"
        />
        <MetricCard label="Recently Reviewed" value={reviewedPayments.length.toString()} tone="green" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Pending Queue</h2>
        </div>

        {pendingPayments.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">No pending payment verifications.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {payment.user?.name || 'Unknown Member'}
                    </p>
                    <p className="text-sm text-gray-600">{payment.user?.email}</p>
                    <p className="text-sm text-gray-500">
                      {payment.user?.department || 'N/A'} · {payment.type.replace('_', ' ')}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Submitted: {formatDateTime(payment.date)}
                    </p>
                    <p className="text-sm text-gray-500">Reference: {payment.transactionReference || 'N/A'}</p>
                    <p className="text-sm text-gray-500">
                      Proof: {payment.proofImage ? (
                        <a href={payment.proofImage} target="_blank" className="text-primary-600 hover:underline" rel="noreferrer">
                          View proof
                        </a>
                      ) : 'N/A'}
                    </p>
                    <p className="mt-2 text-sm font-medium text-gray-700">
                      Amount: <span className="text-gray-900">{formatCurrency(payment.amount)}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Date received: {formatDateTime(payment.createdAt)}
                    </p>
                    {payment.notes && <p className="mt-1 text-sm text-gray-500">{payment.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    <form action={reviewPayment}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button
                        type="submit"
                        className="rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </form>

                    <form action={reviewPayment}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button
                        type="submit"
                        className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
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

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recently Reviewed</h2>
        </div>

        {reviewedPayments.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">No reviewed payments yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {reviewedPayments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-2 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-gray-900">{payment.user?.name || 'Unknown Member'}</p>
                  <p className="text-gray-500">{payment.type.replace('_', ' ')} · {formatCurrency(payment.amount)}</p>
                  <p className="text-gray-500">Verified by: {payment.reviewedBy || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{payment.reviewedAt ? `Verification date: ${formatDateTime(payment.reviewedAt)}` : '-'}</span>
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

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'blue' | 'green' }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    green: 'border-green-200 bg-green-50 text-green-800',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
