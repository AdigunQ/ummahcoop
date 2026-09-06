import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Upload, Users, UserPlus, Wallet, Receipt, PiggyBank } from 'lucide-react'
import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import { PeriodPicker } from '@/components/admin/period-picker'
import { LedgerTable } from '@/components/ui/ledger-table'
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
  return columns.includes('Employee No.') || columns.includes('Employee Name')
    ? 'combined'
    : 'legacy'
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
  selectedPeriod: string
): Record<string, unknown> {
  const staffId = pickText(row, ['Staff ID', 'Employee No.']) || '-'
  const name = pickText(row, ['Name', 'Employee Name']) || '-'
  const amount =
    pickNumber(row, ['Amount']) ||
    pickNumber(row, ['Total']) ||
    pickNumber(row, ['Thrift Savings', 'Monthly Saving']) +
      pickNumber(row, ['Special Savings', 'Special Saving'])
  const month = pickText(row, ['Month', 'Month Joined']) || formatMonthColumn(selectedPeriod)
  const monthlySaving = pickNumber(row, ['Thrift Savings', 'Monthly Saving'])
  const specialSaving = pickNumber(row, ['Special Savings', 'Special Saving'])
  const loan = pickNumber(row, ['Loan', 'Loan Originated'])
  const managementFee = pickNumber(row, ['Management Fee'])
  const commodity = pickNumber(row, ['Commodity', 'Commodity Requests', 'Comodity'])
  const monthlyFee = pickNumber(row, ['Monthly Fee', 'Charges'])
  const formFee = pickNumber(row, ['Form Fee', 'New Member Fee'])
  const total =
    pickNumber(row, ['Total', 'Amount']) ||
    monthlySaving + specialSaving + loan + managementFee + commodity + monthlyFee + formFee

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
  return value.filter(
    (item): item is UploadedSnapshotRow =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
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

function toDisplayRowFromSnapshot(
  row: UploadedSnapshotRow,
  index: number,
  style: SnapshotStyle,
  selectedPeriod: string
): DisplayRow {
  const abanoColumns = buildAbanoFromSnapshotRow(row, selectedPeriod)

  return {
    serial: pickNumber(row, ['S/N', 'Serial']) > 0 ? pickNumber(row, ['S/N', 'Serial']) : index + 1,
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
  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.VIEW_MEMBER_DATA
    ))
  ) {
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

  if (
    latestUploadedMonth &&
    isValidMonthPeriod(latestUploadedMonth.period) &&
    isValidMonthPeriod(currentPeriod)
  ) {
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
  const firstSnapshotKeys =
    snapshotRows.length > 0 ? Object.keys(snapshotRows[0] as Record<string, unknown>) : []
  const snapshotStyle: SnapshotStyle = detectSnapshotStyle(
    uploadedColumns.length ? uploadedColumns : firstSnapshotKeys
  )
  const isCurrentLiveView = shouldUseLiveProjection
  let displayRows: DisplayRow[] = usingSnapshot
    ? snapshotRows.map((row, index) =>
        toDisplayRowFromSnapshot(row, index, snapshotStyle, selectedPeriod)
      )
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
    <div className="admin-page">
      <AdminHeading
        section="Data management"
        title="Member data"
        description="Monthly contributions, deductions and fees, by member."
        actions={
          <Link href="/dashboard/import-members" className="btn-primary !text-xs">
            <Upload className="h-4 w-4" /> Import workbook
          </Link>
        }
      />
      <div className="admin-ledger-context">
        <PeriodPicker options={monthOptions} value={selectedPeriod} />
        <span className="admin-tag">
          {isCurrentLiveView ? 'Live projection' : 'Uploaded snapshot'}
        </span>
      </div>
      <AdminStats
        items={[
          {
            label: 'Members',
            value: String(totals.rows),
            note: totals.newMembers + ' new / ' + totals.oldMembers + ' existing',
          },
          {
            label: 'Savings this month',
            value: formatCurrency(totals.savings),
            note: 'Thrift and special savings',
          },
          {
            label: 'Scheduled fees',
            value: formatCurrency(totals.fees),
            note: 'Monthly and new member fees',
          },
        ]}
      />
      {isCurrentLiveView && latestUploadedMonth && (
        <p className="rounded-xl border border-accent/15 bg-accent/5 px-4 py-3 text-xs leading-6 text-muted-foreground">
          The live month carries forward members from {latestUploadedMonth.label}, with new
          registrations included as they join.
        </p>
      )}
      <LedgerTable
        key={selectedPeriod}
        title={
          formatPeriodLabel(selectedPeriod) +
          (isCurrentLiveView ? ' · Live ledger' : ' · Monthly ledger')
        }
        description={`${displayRows.length.toLocaleString()} member records. Scroll across to view all columns.`}
        columns={[...tableColumns]}
        rows={displayRows.map((row) => ({
          key: `${selectedPeriod}-${row.staffId}-${row.serial}`,
          cells: ABANO_COLUMNS.map((column) => {
            const value = row.abanoColumns?.[column]
            const isCurrency = Boolean((CURRENCY_COLUMNS as Record<string, boolean>)[column])
            const parsed = typeof value === 'number' ? value : toNumber(value)
            return value === null || value === undefined || String(value).trim() === ''
              ? ''
              : isCurrency
                ? formatBlankableCurrency(parsed)
                : toText(value)
          }),
        }))}
      />
    </div>
  )
}
