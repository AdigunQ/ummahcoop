import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export default async function MyLoansPage() {
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
      loanBalance: true,
      loans: {
        include: {
          repayments: {
            orderBy: { date: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!member) {
    redirect('/login')
  }

  const activeLoans = member.loans.filter((loan) => loan.status === 'APPROVED')
  const pendingLoans = member.loans.filter((loan) => loan.status === 'PENDING')
  const totalApproved = activeLoans.reduce((sum, loan) => sum + loan.amount, 0)

  return (
    <div className="animate-fadeIn space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Loans</h1>
        <p className="mt-1 text-gray-500">Track active facilities, pending requests, and repayment progress.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Total Loan Requests" value={member.loans.length.toString()} tone="blue" />
        <MetricCard label="Active Loans" value={activeLoans.length.toString()} tone="green" />
        <MetricCard label="Pending Review" value={pendingLoans.length.toString()} tone="amber" />
        <MetricCard label="Outstanding Balance" value={formatCurrency(member.loanBalance)} tone="purple" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Loan Portfolio</h2>
        </div>
        {member.loans.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">No loan records available.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {member.loans.map((loan) => (
              <div key={loan.id} className="px-6 py-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(loan.amount)}</p>
                    <p className="text-sm text-gray-600">{loan.purpose}</p>
                    <p className="text-xs text-gray-500">
                      {loan.duration} months · {loan.interestRate}% interest · Submitted {formatDateTime(loan.createdAt)}
                    </p>
                    {loan.totalRepayable && (
                      <p className="mt-1 text-xs text-gray-500">
                        Total repayable: {formatCurrency(loan.totalRepayable)} · Monthly: {formatCurrency(loan.monthlyPayment || 0)}
                      </p>
                    )}
                    {loan.disbursementBankName && (
                      <p className="mt-1 text-xs text-gray-500">
                        Disbursed to: {loan.disbursementBankName} / {loan.disbursementAccountNumber} / {loan.disbursementAccountName}
                      </p>
                    )}
                    {loan.status === 'APPROVED' && (
                      <p className="mt-1 text-xs text-gray-500">
                        Repayment is deducted monthly via Finance Department. Direct repayment into cooperative account updates your monthly finance report deductions.
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <StatusBadge status={loan.status} />
                    <p className="mt-2 text-sm font-medium text-gray-700">
                      Balance: {formatCurrency(loan.balance)}
                    </p>
                  </div>
                </div>

                {loan.repayments.length > 0 && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Recent Repayments</p>
                    <div className="space-y-1">
                      {loan.repayments.map((repayment) => (
                        <div key={repayment.id} className="flex items-center justify-between text-xs text-gray-600">
                          <span>{formatDateTime(repayment.date)}</span>
                          <span className="font-medium text-gray-800">{formatCurrency(repayment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Snapshot</h3>
        <p className="mt-2 text-sm text-gray-600">
          Total approved facilities: <span className="font-semibold text-gray-900">{formatCurrency(totalApproved)}</span>
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Current exposure: <span className="font-semibold text-gray-900">{formatCurrency(member.loanBalance)}</span>
        </p>
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
    purple: 'border-purple-200 bg-purple-50 text-purple-800',
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
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
  }

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
