import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDate } from '@/lib/utils'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import { resolveContributionPlans } from '@/lib/contribution-plans'

function monthRange(baseDate: Date) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1)
  return { start, end }
}

export default async function FinanceReportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.VIEW_FINANCE
    ))
  ) {
    redirect('/dashboard')
  }

  const today = new Date()
  const { start, end } = monthRange(today)

  const [storedSavers, approvedLoans, directRepaymentsThisMonth] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'MEMBER',
        status: 'ACTIVE',
        voucherEnabled: true,
      },
      select: {
        id: true,
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
  const activeSavers = await resolveContributionPlans(storedSavers)

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

  const monthlySavingsTotal = activeSavers.reduce(
    (sum, member) => sum + (member.monthlyContribution || 0),
    0
  )
  const monthlyLoanDeductionTotal = loanReportRows.reduce((sum, loan) => sum + loan.deductionDue, 0)

  return (
    <div className="admin-page">
      <AdminHeading
        section="Finance"
        title="Finance report"
        description={
          <>
            Report period: {formatDate(start)} - {formatDate(new Date(end.getTime() - 1))}
          </>
        }
      />

      <AdminStats
        items={[
          { label: 'Savings Deduction Total', value: formatCurrency(monthlySavingsTotal) },
          { label: 'Loan Deduction Total', value: formatCurrency(monthlyLoanDeductionTotal) },
          {
            label: 'Members with Loan Deductions',
            value: loanReportRows.filter((row) => row.deductionDue > 0).length.toString(),
          },
        ]}
      />

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Savings Deduction List (Finance)
          </h2>
        </div>
        {activeSavers.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground">
            No active saver records.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs normal-case tracking-normal text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Staff ID</th>
                  <th className="px-6 py-3">Department</th>
                  <th className="px-6 py-3">Monthly Savings Deduction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeSavers.map((member) => (
                  <tr key={`${member.staffId}-${member.name}`}>
                    <td className="px-6 py-3 font-medium text-foreground">{member.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{member.staffId || 'N/A'}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {member.department || 'N/A'}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {formatCurrency(member.monthlyContribution || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Outstanding Loan Deduction Status (Finance)
          </h2>
        </div>
        {loanReportRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground">
            No approved outstanding loans to report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs normal-case tracking-normal text-muted-foreground">
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
              <tbody className="divide-y divide-border">
                {loanReportRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-3 font-medium text-foreground">
                      {row.user?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {row.user?.staffId || 'N/A'}
                    </td>
                    <td className="px-6 py-3 text-foreground">{formatCurrency(row.balance)}</td>
                    <td className="px-6 py-3 text-foreground">
                      {formatCurrency(row.monthlyPayment || 0)}
                    </td>
                    <td className="px-6 py-3 text-foreground">{formatCurrency(row.directPaid)}</td>
                    <td className="px-6 py-3 font-semibold text-foreground">
                      {formatCurrency(row.deductionDue)}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {row.disbursementBankName || 'N/A'} / {row.disbursementAccountNumber || 'N/A'}{' '}
                      / {row.disbursementAccountName || 'N/A'}
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
