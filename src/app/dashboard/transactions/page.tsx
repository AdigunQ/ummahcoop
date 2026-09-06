import { AdminHeading } from '@/components/admin/admin-ui'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.VIEW_FINANCE
    ))
  ) {
    redirect('/dashboard')
  }

  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          type: true,
        },
      },
    },
  })

  const totalVolume = transactions.reduce((sum, txn) => sum + txn.amount, 0)
  const completedCount = transactions.filter((txn) => txn.status === 'COMPLETED').length
  const pendingCount = transactions.filter((txn) => txn.status === 'PENDING').length

  return (
    <div className="admin-page">
      <AdminHeading
        section="Finance"
        title="Transactions"
        description={<>Detailed records of contributions, repayments, and disbursements.</>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Records" value={transactions.length.toString()} tone="blue" />
        <MetricCard label="Completed" value={completedCount.toString()} tone="green" />
        <MetricCard label="Pending" value={pendingCount.toString()} tone="amber" />
        <MetricCard label="Total Volume" value={formatCurrency(totalVolume)} tone="purple" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-surface-2">
            <tr>
              <HeadCell label="Date" />
              <HeadCell label="Member" />
              <HeadCell label="Reference" />
              <HeadCell label="Type" />
              <HeadCell label="Amount" />
              <HeadCell label="Status" />
              <HeadCell label="Payment Link" />
              <HeadCell label="Description" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-surface-2">
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {formatDateTime(txn.createdAt)}
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-foreground">
                    {txn.user?.name || 'Unknown Member'}
                  </p>
                  <p className="text-sm text-muted-foreground">{txn.user?.email}</p>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-foreground">{txn.reference}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-foreground">
                    {txn.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-foreground">
                  {formatCurrency(txn.amount)}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={txn.status} />
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {txn.payment
                    ? `${txn.payment.type.replace('_', ' ')} · ${txn.payment.status}`
                    : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {txn.description || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'blue' | 'green' | 'amber' | 'purple'
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    purple: 'border-primary-200 bg-primary-50 text-primary-800',
  }

  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  )
}

function HeadCell({ label }: { label: string }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-semibold normal-case tracking-normal text-muted-foreground">
      {label}
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    FAILED: 'bg-red-100 text-red-800',
  }

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-surface-2 text-foreground'}`}
    >
      {status}
    </span>
  )
}
