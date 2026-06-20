import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export default async function HistoryPage() {
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
      id: true,
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
    },
  })

  if (!member) {
    redirect('/login')
  }

  return (
    <div className="animate-fadeIn space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transaction History</h1>
        <p className="mt-1 text-gray-500">Full member timeline for payment submissions and ledger activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Payment Records" value={member.payments.length.toString()} tone="blue" />
        <MetricCard label="Ledger Records" value={member.transactions.length.toString()} tone="green" />
        <MetricCard
          label="Total Submitted"
          value={formatCurrency(member.payments.reduce((sum, payment) => sum + payment.amount, 0))}
          tone="amber"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Payment Submissions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-50">
              <tr>
                <HeadCell label="Date" />
                <HeadCell label="Type" />
                <HeadCell label="Amount" />
                <HeadCell label="Status" />
                <HeadCell label="Notes" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {member.payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No payment records yet.
                  </td>
                </tr>
              ) : (
                member.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(payment.date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{payment.type.replace('_', ' ')}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{payment.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Ledger Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-gray-50">
              <tr>
                <HeadCell label="Date" />
                <HeadCell label="Reference" />
                <HeadCell label="Type" />
                <HeadCell label="Amount" />
                <HeadCell label="Status" />
                <HeadCell label="Description" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {member.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No transaction ledger records yet.
                  </td>
                </tr>
              ) : (
                member.transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDateTime(txn.createdAt)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{txn.reference}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{txn.type.replace('_', ' ')}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(txn.amount)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={txn.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{txn.description || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'amber' }) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function HeadCell({ label }: { label: string }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</th>
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
