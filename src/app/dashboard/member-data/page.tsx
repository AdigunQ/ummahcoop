import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { buildVoucherDataset, resolveVoucherPeriod, type VoucherRow } from '@/lib/vouchers'
import { getCurrentMemberLiveDataset } from '@/lib/current-member-data'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

type SearchParams = {
  period?: string
}

type MonthOption = {
  period: string
  label: string
  isUploaded: boolean
}

type UploadedSnapshotRow = Record<string, unknown>

const ABANO_COLUMNS = [
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
] as const

type SnapshotStyle = 'legacy' | 'combined'

const CURRENCY_COLUMNS = {
  'Employee No.': false,
  'Employee Name': false,
  Amount: true,
  Month: false,
  'Monthly Saving': true,
  'Special Saving': true,
  Loan: true,
  'Management Fee': true,
  Commodity: true,
  'Monthly Fee': true,
  'Form Fee': true,
  Total: true,
  'Thrift Savings': true,
  'Special Savings': true,
  Charges: true,
  'New Member Fee': true,
} as const

type DisplayRow = {
  serial: number
  staffId: string
  name: string
  thriftSavings: number
  specialSavings: number
  charges: number
  newMemberFee: number
  total: number
  memberType: 'NEW' | 'OLD'
  abanoColumns: Record<string, unknown>
  raw?: UploadedSnapshotRow
}

function toText(value: unknown): string {
  return String(value ?? '').trim()
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function detectSnapshotStyle(columns: string[]): SnapshotStyle {
  return columns.includes('Employee No.') || columns.includes('Employee Name') ? 'combined' : 'legacy'
}

function pickText(row: UploadedSnapshotRow, keys: string[]): string {
  for (const key of keys) {
    const value = toText(row[key])
    if (value) return value
  }
  return ''
}

function pickNumber(row: UploadedSnapshotRow, keys: string[]): number {
  for (const key of keys) {
    const value = row[key]
    if (value === undefined) continue
    const parsed = toNumber(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function formatMonthColumn(period: string): string {
  const parsed = formatPeriodLabel(period)
  return parsed || period
}

function buildAbanoFromSnapshotRow(
  row: UploadedSnapshotRow,
  selectedPeriod: string,
): Record<string, unknown> {
  const staffId = pickText(row, ['Staff ID', 'Employee No.']) || '-'
  const name = pickText(row, ['Name', 'Employee Name']) || '-'
  const amount =
    pickNumber(row, ['Amount']) ||
    pickNumber(row, ['Total']) ||
    pickNumber(row, ['Thrift Savings', 'Monthly Saving']) + pickNumber(row, ['Special Savings', 'Special Saving'])
  const month = pickText(row, ['Month', 'Month Joined']) || formatMonthColumn(selectedPeriod)
  const monthlySaving = pickNumber(row, ['Thrift Savings', 'Monthly Saving'])
  const specialSaving = pickNumber(row, ['Special Savings', 'Special Saving'])
  const loan = pickNumber(row, ['Loan', 'Loan Originated'])
  const managementFee = pickNumber(row, ['Management Fee'])
  const commodity = pickNumber(row, ['Commodity', 'Commodity Requests', 'Comodity'])
  const monthlyFee = pickNumber(row, ['Monthly Fee', 'Charges'])
  const formFee = pickNumber(row, ['Form Fee', 'New Member Fee'])
  const total = pickNumber(row, ['Total', 'Amount']) || monthlySaving + specialSaving + loan + managementFee + commodity + monthlyFee + formFee

  return {
    'Employee No.': staffId,
    'Employee Name': name,
    Amount: amount,
    Month: month,
    'Monthly Saving': monthlySaving,
    'Special Saving': specialSaving,
    Loan: loan,
    'Management Fee': managementFee,
    Commodity: commodity,
    'Monthly Fee': monthlyFee,
    'Form Fee': formFee,
    Total: total,
  }
}

function buildAbanoFromLiveRow(row: VoucherRow, selectedPeriod: string): Record<string, unknown> {
  const amount = row.monthlySavings + row.specialSavings

  return {
    'Employee No.': row.staffId || '-',
    'Employee Name': row.name || '-',
    Amount: amount,
    Month: formatMonthColumn(selectedPeriod),
    'Monthly Saving': row.monthlySavings,
    'Special Saving': row.specialSavings,
    Loan: 0,
    'Management Fee': 0,
    Commodity: 0,
    'Monthly Fee': row.monthlyCharges,
    'Form Fee': row.newMemberFee,
    Total: row.totalSavings,
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim()

  if (!cleaned) return 0
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function toSnapshotRows(value: unknown): UploadedSnapshotRow[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is UploadedSnapshotRow => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
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

function comparePeriods(left: string, right: string): number {
  return left.localeCompare(right)
}

function nextMonthPeriod(period: string): string {
  const match = period.trim().match(/^(20\d{2})-(0[1-9]|1[0-2])$/)
  if (!match) return period

  const year = Number(match[1])
  let month = Number(match[2])

  month += 1
  if (month > 12) {
    month = 1
    return `${year + 1}-01`
  }

  return `${year}-${String(month).padStart(2, '0')}`
}

function isValidMonthPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
}

function formatBlankableCurrency(value: number): string {
  return value > 0 ? formatCurrency(value) : ''
}

function toDisplayRowFromSnapshot(row: UploadedSnapshotRow, index: number, style: SnapshotStyle, selectedPeriod: string): DisplayRow {
  const abanoColumns = buildAbanoFromSnapshotRow(row, selectedPeriod)

  return {
    serial:
      pickNumber(row, ['S/N', 'Serial']) > 0
        ? pickNumber(row, ['S/N', 'Serial'])
        : index + 1,
    staffId: pickText(row, ['Staff ID', 'Employee No.']) || '-',
    name: pickText(row, ['Name', 'Employee Name']) || '-',
    thriftSavings: pickNumber(row, ['Thrift Savings', 'Monthly Saving']),
    specialSavings: pickNumber(row, ['Special Savings', 'Special Saving']),
    charges: pickNumber(row, ['Charges', 'Monthly Fee']),
    newMemberFee: pickNumber(row, ['New Member Fee', 'Form Fee']),
    total: pickNumber(row, ['Total', 'Amount']),
    memberType:
      style === 'combined'
        ? pickNumber(row, ['Form Fee', 'New Member Fee']) > 0
          ? 'NEW'
          : 'OLD'
        : pickText(row, ['Member Type'])?.toUpperCase() === 'NEW'
          ? 'NEW'
          : 'OLD',
    raw: row,
    abanoColumns,
  }
}

function toDisplayRowFromVoucher(row: VoucherRow, selectedPeriod: string): DisplayRow {
  const abanoColumns = buildAbanoFromLiveRow(row, selectedPeriod)

  return {
    serial: row.serial,
    staffId: row.staffId || '-',
    name: row.name || '-',
    thriftSavings: row.monthlySavings,
    specialSavings: row.specialSavings,
    charges: row.monthlyCharges,
    newMemberFee: row.newMemberFee,
    total: row.totalSavings,
    memberType: row.memberType,
    abanoColumns,
  }
}

export default async function MemberDataPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) redirect('/login')
  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.VIEW_MEMBER_DATA))) {
    redirect('/dashboard')
  }

  const months = await prisma.memberDataMonth.findMany({
    orderBy: { period: 'asc' },
    select: { period: true, label: true },
  })

  const currentPeriod = resolveVoucherPeriod().period
  const selectedPeriod = resolveVoucherPeriod(searchParams?.period).period
  const latestUploadedMonth = months.length > 0 ? months[months.length - 1] : null

  const uploadedMonth = await prisma.memberDataMonth.findUnique({
    where: { period: selectedPeriod },
    select: {
      period: true,
      label: true,
      rowCount: true,
      rows: true,
      columns: true,
      uploadedAt: true,
    },
  })

  const usingSnapshot = Boolean(uploadedMonth)
  const shouldUseLiveProjection =
    !usingSnapshot &&
    Boolean(latestUploadedMonth) &&
    isValidMonthPeriod(selectedPeriod) &&
    isValidMonthPeriod(currentPeriod) &&
    comparePeriods(selectedPeriod, latestUploadedMonth?.period || '') > 0 &&
    comparePeriods(selectedPeriod, currentPeriod) <= 0

  const liveDataset = shouldUseLiveProjection
    ? await getCurrentMemberLiveDataset(selectedPeriod)
    : await buildVoucherDataset(selectedPeriod)

  const monthOptions: MonthOption[] = months.map((month) => ({
    period: month.period,
    label: month.label,
    isUploaded: true,
  }))

  if (latestUploadedMonth && isValidMonthPeriod(latestUploadedMonth.period) && isValidMonthPeriod(currentPeriod)) {
    const uploadedPeriods = new Set(months.map((month) => month.period))
    let periodCursor = nextMonthPeriod(latestUploadedMonth.period)
    while (comparePeriods(periodCursor, currentPeriod) <= 0) {
      if (!uploadedPeriods.has(periodCursor)) {
        monthOptions.push({
          period: periodCursor,
          label: `${formatPeriodLabel(periodCursor)} (Live)`,
          isUploaded: false,
        })
      }
      periodCursor = nextMonthPeriod(periodCursor)
      if (periodCursor === latestUploadedMonth.period) break
    }
  } else if (!monthOptions.some((month) => month.period === currentPeriod)) {
    monthOptions.push({
      period: currentPeriod,
      label: `${formatPeriodLabel(currentPeriod)} (Live)`,
      isUploaded: false,
    })
  }

  monthOptions.sort((a, b) => a.period.localeCompare(b.period))

  const snapshotRows = uploadedMonth ? toSnapshotRows(uploadedMonth.rows) : []
  const uploadedColumns = asStringArray(uploadedMonth?.columns as unknown)
  const firstSnapshotKeys = snapshotRows.length > 0 ? Object.keys(snapshotRows[0] as Record<string, unknown>) : []
  const snapshotStyle: SnapshotStyle = detectSnapshotStyle(uploadedColumns.length ? uploadedColumns : firstSnapshotKeys)
  const isCurrentLiveView = shouldUseLiveProjection
  let displayRows: DisplayRow[] = usingSnapshot
    ? snapshotRows.map((row, index) => toDisplayRowFromSnapshot(row, index, snapshotStyle, selectedPeriod))
    : liveDataset.rows.map((row) => toDisplayRowFromVoucher(row, selectedPeriod))

  const tableColumns = ABANO_COLUMNS

  const totals = {
    rows: displayRows.length,
    newMembers: displayRows.filter((row) => row.memberType === 'NEW').length,
    oldMembers: displayRows.filter((row) => row.memberType === 'OLD').length,
    fees: displayRows.reduce((sum, row) => sum + row.charges + row.newMemberFee, 0),
    savings: displayRows.reduce((sum, row) => sum + row.thriftSavings + row.specialSavings, 0),
  }

  const currentLiveNote =
    isCurrentLiveView && latestUploadedMonth
      ? `${formatPeriodLabel(selectedPeriod)} keeps the same member list as ${latestUploadedMonth.label}. Rows carried forward from the previous snapshot show as OLD with Monthly Fee = 100 and Form Fee blank until fresh registrations are added.`
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Member Data</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Imported data is now rendered with the ABano workbook column names.
          </p>
        </div>

        <Link
          href="/dashboard/import-members"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Upload / Import
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {monthOptions.map((month) => {
          const active = month.period === selectedPeriod
          return (
            <Link
              key={month.period}
              href={`/dashboard/member-data?period=${encodeURIComponent(month.period)}`}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                active ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {month.label}
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <MetricCard label={usingSnapshot ? 'Snapshot Rows' : 'Current Members'} value={String(totals.rows)} tone="blue" />
        <MetricCard label="New Members" value={String(totals.newMembers)} tone="green" />
        <MetricCard label="Old Members" value={String(totals.oldMembers)} tone="amber" />
        <MetricCard label="Fees Total" value={formatCurrency(totals.fees)} tone="purple" />
        <MetricCard label="Total Savings" value={formatCurrency(totals.savings)} tone="slate" />
      </div>

      {currentLiveNote && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {currentLiveNote}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {usingSnapshot
              ? `Uploaded Snapshot (${uploadedMonth?.label})`
              : `Current Data (${formatPeriodLabel(selectedPeriod)}${isCurrentLiveView ? ' Live' : ''})`}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {usingSnapshot
              ? `Showing uploaded rows for this month only (${displayRows.length.toLocaleString()} rows). Uploaded ${new Date(uploadedMonth!.uploadedAt).toLocaleString()}.`
              : 'The live month uses ABano-style workbook columns, and rows carried forward from the previous snapshot are shown as OLD with Monthly Fee = 100.'}
          </p>
        </div>

          <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {tableColumns.map((column) => (
                  <th key={column} className="px-6 py-3">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayRows.length === 0 ? (
                <tr>
                    <td
                      colSpan={tableColumns.length}
                      className="px-6 py-10 text-center text-slate-500"
                    >
                      No rows found for this period.
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row) => (
                    <tr key={`${selectedPeriod}-${row.staffId}-${row.serial}`} className="hover:bg-slate-50">
                      {ABANO_COLUMNS.map((column) => {
                        const value = row.abanoColumns?.[column as keyof typeof row.abanoColumns]
                        const isCurrency = Boolean((CURRENCY_COLUMNS as Record<string, boolean>)[column])
                        const parsed = typeof value === 'number' ? value : toNumber(value)
                        return (
                          <td key={`${selectedPeriod}-${row.staffId}-${row.serial}-${column}`} className="px-6 py-3 text-slate-700">
                            {value === null || value === undefined || String(value).trim() === ''
                              ? '—'
                              : isCurrency
                                ? formatBlankableCurrency(parsed)
                                : toText(value)}
                          </td>
                        )
                      })}
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

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'amber' | 'blue' | 'green' | 'purple' | 'slate'
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    purple: 'border-violet-200 bg-violet-50 text-violet-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}
