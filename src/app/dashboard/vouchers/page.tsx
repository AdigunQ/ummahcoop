import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { buildVoucherDataset, resolveVoucherPeriod } from '@/lib/vouchers'
import { getCurrentMemberReportDataset } from '@/lib/current-member-data'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

type SearchParams = {
  period?: string
}

export default async function VouchersPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) redirect('/login')
  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.VIEW_FINANCE
    ))
  )
    redirect('/dashboard')

  const resolved = resolveVoucherPeriod(searchParams?.period)
  const currentPeriod = resolveVoucherPeriod().period
  const isLivePeriod = resolved.period >= currentPeriod
  const dataset = isLivePeriod
    ? await getCurrentMemberReportDataset(resolved.period)
    : await buildVoucherDataset(resolved.period)

  const uploadedMonth = await prisma.memberDataMonth.findUnique({
    where: { period: resolved.period },
    select: {
      period: true,
      label: true,
      rowCount: true,
      uploadedAt: true,
    },
  })

  const abanoColumns = [
    'Employee No.',
    'Employee Name',
    'Amount',
    'Month',
    'Monthly Saving',
    'Special Saving',
    'Loan',
    'Management Fee',
    'Commodity',
    'Monthly Fee',
    'Form Fee',
    'Total',
    'Member Type',
  ] as const

  return (
    <div className="admin-page">
      <AdminHeading
        section="Finance"
        title="Generate report"
        description={
          <>
            Monthly salary deduction report generated from uploaded monthly data when available,
            otherwise from live member records.
          </>
        }
      />

      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Report Period</label>
            <input
              aria-label="Period"
              type="month"
              name="period"
              defaultValue={resolved.period}
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-black"
          >
            Load Period
          </button>
          <Link
            href={`/api/vouchers/export?period=${resolved.period}`}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Generate CSV
          </Link>
          <Link
            href={`/dashboard/member-data?period=${resolved.period}`}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
          >
            View Member Data
          </Link>
        </form>
      </div>

      {isLivePeriod && !uploadedMonth && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-semibold">
            Using current live member data for {formatPeriodLabel(resolved.period)}
          </p>
          <p className="mt-1 text-sm">
            This period carries the latest snapshot forward until fresh members are added, so the
            report stays in step with the current live workbook.
          </p>
        </div>
      )}

      {uploadedMonth && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <p className="font-semibold">Uploaded snapshot found for {uploadedMonth.label}</p>
          <p className="mt-1 text-sm">
            Report output for this period uses the uploaded snapshot. Snapshot rows:{' '}
            {uploadedMonth.rowCount.toLocaleString()} • Uploaded{' '}
            {new Date(uploadedMonth.uploadedAt).toLocaleString()}
          </p>
        </div>
      )}

      <AdminStats
        items={[
          { label: 'Members', value: dataset.rows.length.toString() },
          { label: 'New Members', value: dataset.totals.newMembers.toString() },
          { label: 'Old Members', value: dataset.totals.oldMembers.toString() },
          { label: 'Fees Total', value: formatCurrency(dataset.totals.fees) },
          { label: 'Total Savings', value: formatCurrency(dataset.totals.totalSavings) },
        ]}
      />

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Report Preview</h2>
        </div>

        {dataset.rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted-foreground">
            No active members available for report generation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead className="bg-surface-2 text-left text-xs normal-case tracking-normal text-muted-foreground">
                <tr>
                  {abanoColumns.map((column) => (
                    <th key={column} className="px-6 py-3">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dataset.rows.map((row) => (
                  <tr key={`${row.staffId}-${row.serial}`}>
                    <td className="px-6 py-3 text-foreground">{row.staffId || '-'}</td>
                    <td className="px-6 py-3 font-medium text-foreground">
                      {row.name || 'Unnamed Member'}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {formatCurrency(row.monthlySavings + row.specialSavings)}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {formatPeriodLabel(dataset.period)}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {formatCurrency(row.monthlySavings)}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {formatCurrency(row.specialSavings)}
                    </td>
                    <td className="px-6 py-3 text-foreground">{formatCurrency(0)}</td>
                    <td className="px-6 py-3 text-foreground">{formatCurrency(0)}</td>
                    <td className="px-6 py-3 text-foreground">{formatCurrency(0)}</td>
                    <td className="px-6 py-3 text-foreground">
                      {formatMaybeCurrency(row.monthlyCharges)}
                    </td>
                    <td className="px-6 py-3 text-foreground">
                      {formatMaybeCurrency(row.newMemberFee)}
                    </td>
                    <td className="px-6 py-3 font-semibold text-foreground">
                      {formatCurrency(row.totalSavings)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.memberType === 'NEW'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.memberType}
                      </span>
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

function formatPeriodLabel(period: string): string {
  const match = period.trim().match(/^(20\d{2})-(0?[1-9]|1[0-2])$/)
  if (!match) return period

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month)) return period

  return new Date(year, month - 1, 1).toLocaleDateString('en-NG', {
    month: 'short',
    year: 'numeric',
  })
}

function formatMaybeCurrency(value: number): string {
  if (!value) return '—'
  return formatCurrency(value)
}
