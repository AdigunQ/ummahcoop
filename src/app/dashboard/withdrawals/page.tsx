import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import WithdrawalForm from './WithdrawalForm'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'green' | 'blue' }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

export default async function WithdrawalsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      withdrawals: { orderBy: { requestedAt: 'desc' }, take: 10 }
    }
  })

  if (!member) redirect('/login')

  return (
    <div className="animate-fadeIn space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Withdraw Funds</h1>
        <p className="mt-1 text-gray-500">
          Special savings withdrawals open in October only. Thrift savings withdrawal is handled through full membership closure.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard label="Monthly Savings" value={formatCurrency(member.balance)} tone="blue" />
        <MetricCard label="Special Savings" value={formatCurrency(member.specialBalance)} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Withdrawal</h2>
          <WithdrawalForm member={member} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">History</h2>
          </div>
          {member.withdrawals.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No requests found.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {member.withdrawals.map((request) => (
                <div key={request.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {request.source === 'SPECIAL_SAVINGS' ? 'Special Withdrawal' : 'Monthly Withdrawal'}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(request.requestedAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(request.approvedAmount ?? request.requestedAmount)}
                      </p>
                      <StatusBadge status={request.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
