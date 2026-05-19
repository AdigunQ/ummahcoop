import { prisma } from '@/lib/prisma'

export const VOUCHER_TITLE = 'LIST OF NAIA MULTIPUPOSE COOPERATIVES MEMBERS'
export const VOUCHER_CUTOFF_DAY = 15
const VOUCHER_MONTHLY_CHARGE = 100
const VOUCHER_NEW_MEMBER_FEE = 1000

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

export type VoucherRow = {
  serial: number
  staffId: string
  name: string
  monthlySavings: number
  specialSavings: number
  monthlyCharges: number
  newMemberFee: number
  memberFee: number
  totalSavings: number
  memberType: 'NEW' | 'OLD'
}

export type VoucherDataset = {
  period: string
  start: Date
  end: Date
  rows: VoucherRow[]
  totals: {
    monthlySavings: number
    specialSavings: number
    fees: number
    totalSavings: number
    newMembers: number
    oldMembers: number
  }
}

type SnapshotRow = {
  'S/N'?: number
  'Staff ID'?: string
  Name?: string
  'Thrift Savings'?: number
  'Special Savings'?: number
  'Month Joined'?: string
  Charges?: number
  'New Member Fee'?: number
  Total?: number
  'Member Type'?: 'NEW' | 'OLD' | string
}

export function resolveVoucherPeriod(periodInput?: string) {
  const fallback = new Date()
  const value = (periodInput || '').trim()
  const valid = /^\d{4}-\d{2}$/.test(value)
  const [year, month] = (valid ? value : `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number)

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  const period = `${year}-${String(month).padStart(2, '0')}`

  return { period, start, end }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value ?? '').replace(/,/g, '').replace(/\s+/g, '').trim()
  if (!cleaned) return 0
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function toSnapshotRows(value: unknown): SnapshotRow[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SnapshotRow => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function comparePeriods(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function normalizePeriodLike(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}`
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 30000) {
    const utcDays = Math.floor(value - 25569)
    const date = new Date(utcDays * 86400 * 1000)
    if (!Number.isNaN(date.valueOf())) {
      return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`
    }
  }

  const raw = String(value ?? '').trim()
  if (!raw) return null

  const compact = raw.replace(/\s+/g, ' ')

  const monthYearMatch = compact.match(
    /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[-/ ]\s*(20\d{2})$/i
  )
  if (monthYearMatch) {
    const token = monthYearMatch[1].toLowerCase()
    const year = Number(monthYearMatch[2])
    const month = MONTH_NAME_TO_INDEX[token]
    if (month && Number.isFinite(year)) {
      return `${year}-${pad2(month)}`
    }
  }

  const yearMonthMatch = compact.match(/^(20\d{2})\s*[-/ ]\s*(0?[1-9]|1[0-2])(?:\s*[-/ ]\s*\d{1,2})?$/)
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1])
    const month = Number(yearMonthMatch[2])
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return `${year}-${pad2(month)}`
    }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.valueOf())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}`
  }

  return null
}

export function firstVoucherPeriodForCreatedAt(createdAt: Date): string {
  let year = createdAt.getUTCFullYear()
  let monthIndex = createdAt.getUTCMonth() // 0-11
  const day = createdAt.getUTCDate()

  // Rule: voucher prepared by the 15th. If registration is after 15th,
  // first voucher is next month.
  if (day > VOUCHER_CUTOFF_DAY) {
    monthIndex += 1
    if (monthIndex >= 12) {
      monthIndex = 0
      year += 1
    }
  }

  return `${year}-${pad2(monthIndex + 1)}`
}

export function isIncludedInVoucherPeriod(createdAt: Date, voucherPeriod: string): boolean {
  return firstVoucherPeriodForCreatedAt(createdAt) <= voucherPeriod
}

function computeTotals(rows: VoucherRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.monthlySavings += row.monthlySavings
      acc.specialSavings += row.specialSavings
      acc.fees += row.memberFee
      acc.totalSavings += row.totalSavings
      if (row.memberType === 'NEW') acc.newMembers += 1
      else acc.oldMembers += 1
      return acc
    },
    { monthlySavings: 0, specialSavings: 0, fees: 0, totalSavings: 0, newMembers: 0, oldMembers: 0 }
  )
}

type VoucherSourceRow = {
  serial: number
  staffId: string
  name: string
  monthlySavings: number
  specialSavings: number
  joinedPeriod: string | null
  rawCharges: number
  rawNewMemberFee: number
  rawTotal: number
  rawMemberType: string
}

function buildVoucherRow(source: VoucherSourceRow, period: string): VoucherRow | null {
  if (source.joinedPeriod && comparePeriods(source.joinedPeriod, period) > 0) {
    return null
  }

  const hasJoinedPeriod = Boolean(source.joinedPeriod)
  const isNew = hasJoinedPeriod ? comparePeriods(source.joinedPeriod as string, period) === 0 : source.rawMemberType === 'NEW' || source.rawNewMemberFee >= VOUCHER_NEW_MEMBER_FEE

  const monthlyCharges = hasJoinedPeriod ? (isNew ? 0 : VOUCHER_MONTHLY_CHARGE) : source.rawCharges
  const newMemberFee = hasJoinedPeriod ? (isNew ? VOUCHER_NEW_MEMBER_FEE : 0) : source.rawNewMemberFee
  const memberFee = monthlyCharges + newMemberFee
  const totalSavings = hasJoinedPeriod
    ? source.monthlySavings + source.specialSavings + memberFee
    : source.rawTotal > 0
      ? source.rawTotal
      : source.monthlySavings + source.specialSavings + memberFee

  return {
    serial: source.serial,
    staffId: source.staffId,
    name: source.name,
    monthlySavings: source.monthlySavings,
    specialSavings: source.specialSavings,
    monthlyCharges,
    newMemberFee,
    memberFee,
    totalSavings,
    memberType: isNew ? 'NEW' : 'OLD',
  }
}

function buildRowsFromSnapshot(snapshotRows: SnapshotRow[], period: string): VoucherRow[] {
  return snapshotRows
    .map((row, index) =>
      buildVoucherRow(
        {
          serial: toNumber(row['S/N']) > 0 ? toNumber(row['S/N']) : index + 1,
          staffId: String(row['Staff ID'] ?? '').trim() || 'N/A',
          name: String(row.Name ?? '').trim() || 'Unnamed Member',
          monthlySavings: toNumber(row['Thrift Savings']),
          specialSavings: toNumber(row['Special Savings']),
          joinedPeriod: normalizePeriodLike(row['Month Joined']),
          rawCharges: toNumber(row.Charges),
          rawNewMemberFee: toNumber(row['New Member Fee']),
          rawTotal: toNumber(row.Total),
          rawMemberType: String(row['Member Type'] ?? '').trim().toUpperCase(),
        },
        period
      )
    )
    .filter((row): row is VoucherRow => Boolean(row))
}

export async function buildVoucherDataset(periodInput?: string): Promise<VoucherDataset> {
  const { period, start, end } = resolveVoucherPeriod(periodInput)

  const uploadedMonth = await prisma.memberDataMonth.findUnique({
    where: { period },
    select: { rows: true },
  })

  const snapshotRows = uploadedMonth ? toSnapshotRows(uploadedMonth.rows) : []
  if (snapshotRows.length > 0) {
    const rows = buildRowsFromSnapshot(snapshotRows, period)
    return {
      period,
      start,
      end,
      rows,
      totals: computeTotals(rows),
    }
  }

  const members = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      status: 'ACTIVE',
      voucherEnabled: true,
      OR: [{ monthlyContribution: { gt: 0 } }, { specialContribution: { gt: 0 } }],
    },
    select: {
      name: true,
      staffId: true,
      monthlyContribution: true,
      specialContribution: true,
      createdAt: true,
    },
    orderBy: [{ staffId: 'asc' }, { name: 'asc' }],
  })

  const rows: VoucherRow[] = members
    .map((member, index) =>
      buildVoucherRow(
        {
          serial: index + 1,
          staffId: member.staffId || 'N/A',
          name: member.name || 'Unnamed Member',
          monthlySavings: member.monthlyContribution || 0,
          specialSavings: member.specialContribution || 0,
          joinedPeriod: firstVoucherPeriodForCreatedAt(member.createdAt),
          rawCharges: VOUCHER_MONTHLY_CHARGE,
          rawNewMemberFee: 0,
          rawTotal: 0,
          rawMemberType: 'OLD',
        },
        period
      )
    )
    .filter((row): row is VoucherRow => Boolean(row))

  return { period, start, end, rows, totals: computeTotals(rows) }
}

function escapeCsv(value: string | number): string {
  const raw = String(value ?? '')
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function buildVoucherCsv(dataset: VoucherDataset): string {
  const lines = [
    ['', '', VOUCHER_TITLE, ''],
    ['S/N', 'Staff ID', 'Name', 'Thrift Savings'],
    ...dataset.rows.map((row) => [row.serial, row.staffId, row.name, row.totalSavings]),
  ]

  return lines
    .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
    .join('\n')
}
