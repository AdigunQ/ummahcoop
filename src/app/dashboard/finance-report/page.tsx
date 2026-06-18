import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

function monthRange(baseDate: Date) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1)
  return { start, end }
}

export default async function FinanceReportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.VIEW_FINANCE))) {
    redirect('/dashboard')
  }

  const today = new Date()
  const { start, end } = monthRange(today)

  const [activeSavers, approvedLoans, directRepaymentsThisMonth] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'MEMBER',
        status: 'ACTIVE',
        voucherEnabled: true,
      },
      select: {
        name: true,
        staffId: true,
        department: true,
        monthlyContribution: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.loan.findMany({
      where: {
        status: 'APPROVED',
        balance: { gt: 0 },
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        balance: true,
        monthlyPayment: true,
        disbursementBankName: true,
        disbursementAccountName: true,
        disbursementAccountNumber: true,
        user: {
          select: {
            name: true,
            staffId: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: {
        type: 'LOAN_REPAYMENT',
        status: 'APPROVED',
        date: {
          gte: start,
          lt: end,
        },
      },
      select: {
        userId: true,
        amount: true,
      },
    }),
  ])

  const directRepaymentByUser = new Map<string, number>()
  for (const payment of directRepaymentsThisMonth) {
    directRepaymentByUser.set(
      payment.userId,
      (directRepaymentByUser.get(payment.userId) || 0) + payment.amount
    )
  }

  const loanReportRows = approvedLoans.map((loan) => {
    const directPaid = directRepaymentByUser.get(loan.userId) || 0
    const scheduled = loan.monthlyPayment || 0
    const deductionDue = Math.max(0, scheduled - directPaid)
    return {
      ...loan,
      directPaid,
      deductionDue,
    }
  })

  const monthlySavingsTotal = activeSavers.reduce((sum, member) => sum + (member.monthlyContribution || 0), 0)
  const monthlyLoanDeductionTotal = loanReportRows.reduce((sum, loan) => sum + loan.deductionDue, 0)

  return (
    <div className="animate-fadeIn space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Finance Monthly Report</h1>
        <p className="mt-1 text-gray-500">
          Report period: {formatDate(start)} - {formatDate(new Date(end.getTime() - 1))}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Savings Deduction Total" value={formatCurrency(monthlySavingsTotal)} tone="blue" />
        <MetricCard label="Loan Deduction Total" value={formatCurrency(monthlyLoanDeductionTotal)} tone="amber" />
        <MetricCard label="Members with Loan Deductions" value={loanReportRows.filter((row) => row.deductionDue > 0).length.toString()} tone="green" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Savings Deduction List (Finance)</h2>
        </div>
        {activeSavers.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">No active saver records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Staff ID</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Monthly Savings Deduction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activeSavers.map((member) => (
                  <tr key={`${member.staffId}-${member.name}`}>
                    <td className="px-6 py-3 font-medium text-gray-900">{member.name}</td>
                    <td className="px-6 py-3 text-gray-600">{member.staffId || 'N/A'}</td>
                    <td className="px-6 py-3 text-gray-600">{member.department || 'N/A'}</td>
                    <td className="px-6 py-3 text-gray-900">{formatCurrency(member.monthlyContribution || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Outstanding Loan Deduction Status (Finance)</h2>
        </div>
        {loanReportRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-500">No approved outstanding loans to report.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Staff ID</th>
                  <th className="px-6 py-3">Outstanding Balance</th>
                  <th className="px-6 py-3">Scheduled Monthly Repayment</th>
                  <th className="px-6 py-3">Direct Payment This Month</th>
                  <th className="px-6 py-3">Deduct via Finance</th>
                  <th className="px-6 py-3">Loan Disbursement Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loanReportRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-3 font-medium text-gray-900">{row.user?.name || 'Unknown'}</td>
                    <td className="px-6 py-3 text-gray-600">{row.user?.staffId || 'N/A'}</td>
                    <td className="px-6 py-3 text-gray-900">{formatCurrency(row.balance)}</td>
                    <td className="px-6 py-3 text-gray-900">{formatCurrency(row.monthlyPayment || 0)}</td>
                    <td className="px-6 py-3 text-gray-900">{formatCurrency(row.directPaid)}</td>
                    <td className="px-6 py-3 font-semibold text-gray-900">{formatCurrency(row.deductionDue)}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {row.disbursementBankName || 'N/A'} / {row.disbursementAccountNumber || 'N/A'} / {row.disbursementAccountName || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
