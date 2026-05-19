import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { buildVoucherDataset, resolveVoucherPeriod, type VoucherRow } from '@/lib/vouchers'
import { getCurrentMemberLiveDataset } from '@/lib/current-member-data'

type SearchParams = {
  period?: string
}

type MonthOption = {
  period: string
  label: string
  isUploaded: boolean
}

type UploadedSnapshotRow = {
  'S/N'?: number
  'Staff ID'?: string
  Name?: string
  'Thrift Savings'?: number
  'Special Savings'?: number
  Charges?: number
  'New Member Fee'?: number
  Total?: number
  'Member Type'?: 'NEW' | 'OLD' | string
}

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

function formatBlankableCurrency(value: number): string {
  return value > 0 ? formatCurrency(value) : ''
}

function toDisplayRowFromSnapshot(row: UploadedSnapshotRow, index: number): DisplayRow {
  return {
    serial: toNumber(row['S/N']) || index + 1,
    staffId: String(row['Staff ID'] ?? '').trim() || '-',
    name: String(row.Name ?? '-'),
    thriftSavings: toNumber(row['Thrift Savings']),
    specialSavings: toNumber(row['Special Savings']),
    charges: toNumber(row.Charges),
    newMemberFee: toNumber(row['New Member Fee']),
    total: toNumber(row.Total),
    memberType: String(row['Member Type'] ?? 'OLD').toUpperCase() === 'NEW' ? 'NEW' : 'OLD',
  }
}

function toDisplayRowFromVoucher(row: VoucherRow): DisplayRow {
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
  }
}

export default async function MemberDataPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

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
      uploadedAt: true,
    },
  })

  const usingSnapshot = Boolean(uploadedMonth)
  const liveDataset =
    !usingSnapshot && selectedPeriod === currentPeriod
      ? await getCurrentMemberLiveDataset(selectedPeriod)
      : await buildVoucherDataset(selectedPeriod)

  const monthOptions: MonthOption[] = months.map((month) => ({
    period: month.period,
    label: month.label,
    isUploaded: true,
  }))

  if (!monthOptions.some((month) => month.period === currentPeriod)) {
    monthOptions.push({
      period: currentPeriod,
      label: `${formatPeriodLabel(currentPeriod)} (Live)`,
      isUploaded: false,
    })
  }

  monthOptions.sort((a, b) => a.period.localeCompare(b.period))

  const snapshotRows = uploadedMonth ? toSnapshotRows(uploadedMonth.rows) : []
  const isCurrentLiveView = !usingSnapshot && selectedPeriod === currentPeriod
  const displayRows: DisplayRow[] = usingSnapshot
    ? snapshotRows.map((row, index) => toDisplayRowFromSnapshot(row, index))
    : liveDataset.rows.map((row) => toDisplayRowFromVoucher(row))

  const totals = {
    rows: displayRows.length,
    newMembers: displayRows.filter((row) => row.memberType === 'NEW').length,
    oldMembers: displayRows.filter((row) => row.memberType === 'OLD').length,
    fees: displayRows.reduce((sum, row) => sum + row.charges + row.newMemberFee, 0),
    savings: displayRows.reduce((sum, row) => sum + row.thriftSavings + row.specialSavings, 0),
  }

  const currentLiveNote =
    isCurrentLiveView && latestUploadedMonth
      ? `${formatPeriodLabel(currentPeriod)} keeps the same member list as ${latestUploadedMonth.label}, but rows that were NEW in April now show as OLD in May with Charges = 100 and New Member Fee blank until fresh May members are added.`
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Member Data</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Uploaded month snapshots and the current live month now use the same columns: S/N, Staff ID, Name, Thrift
            Savings, Special Savings, Charges, New Member Fee, Total, Member Type.
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
              : `Current Data (${formatPeriodLabel(currentPeriod)}${isCurrentLiveView ? ' Live' : ''})`}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {usingSnapshot
              ? `Showing uploaded rows for this month only (${displayRows.length.toLocaleString()} rows). Uploaded ${new Date(uploadedMonth!.uploadedAt).toLocaleString()}.`
              : 'The live month uses the same columns as the workbook, and April rows tagged NEW are shown as OLD in May with a 100 charge.'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">S/N</th>
                <th className="px-6 py-3">Staff ID</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Thrift Savings</th>
                <th className="px-6 py-3">Special Savings</th>
                <th className="px-6 py-3">Charges</th>
                <th className="px-6 py-3">New Member Fee</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Member Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                    No rows found for this period.
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr key={`${selectedPeriod}-${row.staffId}-${row.serial}`} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-700">{row.serial}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">{row.staffId}</td>
                    <td className="px-6 py-3 text-slate-900">{row.name}</td>
                    <td className="px-6 py-3 text-slate-700">{formatCurrency(row.thriftSavings)}</td>
                    <td className="px-6 py-3 text-slate-700">{formatCurrency(row.specialSavings)}</td>
                    <td className="px-6 py-3 text-slate-700">{formatBlankableCurrency(row.charges)}</td>
                    <td className="px-6 py-3 text-slate-700">{formatBlankableCurrency(row.newMemberFee)}</td>
                    <td className="px-6 py-3 font-semibold text-slate-950">{formatCurrency(row.total)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.memberType === 'NEW'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.memberType}
                      </span>
                    </td>
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
