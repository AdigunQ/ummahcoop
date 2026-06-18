import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

export const runtime = 'nodejs'

type ParsedWorkbookRow = {
  serial: number
  staffId: string
  name: string
  thriftSavings: number
  specialSaving: number
  monthlyCharges: number
  newMemberFee: number
  excelTotal: number
  monthJoinedRaw: string
  monthJoinedPeriod: string | null // YYYY-MM
  rowNumber: number
}

type CanonicalMemberRow = {
  'S/N': number
  'Staff ID': string
  Name: string
  'Thrift Savings': number
  'Special Savings': number
  Charges: number | null
  'New Member Fee': number | null
  Total: number
  'Expected Total': number
  Variance: number
  'Member Type': 'NEW' | 'OLD'
  'Month Joined': string // Mon-YYYY
}

type ParsedMonth = {
  period: string
  label: string
  sheetName: string
  rows: CanonicalMemberRow[]
  warnings: string[]
}

type ParseWorkbookResult = {
  months: ParsedMonth[]
  warnings: string[]
}

type HeaderMap = {
  sn: number
  staffId: number
  name: number
  thriftSavings: number
  specialSaving: number
  monthlyCharges: number
  newMemberFee: number
  total: number
  monthJoined: number
}

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

type MonthParts = {
  year: number
  month: number
}

const FEE_START: MonthParts = { year: 2026, month: 2 }

const HEADER_ALIASES = {
  sn: ['s/n', 'sn', 's no', 'serial no', 'serial number'],
  staffId: ['staff id'],
  name: ['name'],
  thriftSavings: ['thrift savings'],
  specialSaving: ['special saving', 'special savings'],
  monthlyCharges: ['monthly charges'],
  newMemberFee: ['new member fee'],
  total: ['total'],
  monthJoined: ['month joined'],
} as const

const CANONICAL_COLUMNS: Array<keyof CanonicalMemberRow> = [
  'S/N',
  'Staff ID',
  'Name',
  'Thrift Savings',
  'Special Savings',
  'Charges',
  'New Member Fee',
  'Total',
  'Expected Total',
  'Variance',
  'Member Type',
  'Month Joined',
]

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^0ctober/, 'october')
    .replace(/^0ct/, 'oct')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function toText(value: unknown): string {
  return String(value ?? '').trim()
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

function normalizeStaffId(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value)).padStart(6, '0')
  }

  const raw = toText(value)
  const cleaned = raw.replace(/\s+/g, '')

  if (/^\d+$/.test(cleaned) && cleaned.length > 0 && cleaned.length < 6) {
    return cleaned.padStart(6, '0')
  }

  return cleaned
}

function monthLabel(period: string): string {
  const [yearPart, monthPart] = period.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return period
  }

  return `${names[month - 1]} ${year}`
}

function monYear(period: string): string {
  const [yearPart, monthPart] = period.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return period
  }

  return `${names[month - 1]}-${year}`
}

function parseMonthParts(period: string | null | undefined): MonthParts | null {
  if (!period) return null

  const cleaned = period.trim()
  const match = cleaned.match(/^(20\d{2})-(0?[1-9]|1[0-2])$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null

  return { year, month }
}

function isValidMonth(period: string | null | undefined): boolean {
  return parseMonthParts(period) !== null
}

function compareMonthParts(left: MonthParts, right: MonthParts): number {
  if (left.year !== right.year) {
    return left.year < right.year ? -1 : 1
  }

  if (left.month !== right.month) {
    return left.month < right.month ? -1 : 1
  }

  return 0
}

function isBefore(left: string | null | undefined, right: MonthParts): boolean {
  const leftParts = parseMonthParts(left)
  if (!leftParts) return false
  return compareMonthParts(leftParts, right) < 0
}

function isSameMonth(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftParts = parseMonthParts(left)
  const rightParts = parseMonthParts(right)
  if (!leftParts || !rightParts) return false
  return compareMonthParts(leftParts, rightParts) === 0
}

function isAfter(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftParts = parseMonthParts(left)
  const rightParts = parseMonthParts(right)
  if (!leftParts || !rightParts) return false
  return compareMonthParts(leftParts, rightParts) > 0
}

function amountOrZero(value: number | null): number {
  return value ?? 0
}

type FeeRow = {
  monthlyCharges: number | null
  newMemberFee: number | null
}

function applyFeeLogic(
  row: FeeRow,
  memberJoinedMonth: string | null,
  currentSheetMonth: string
): FeeRow {
  if (!memberJoinedMonth || !isValidMonth(memberJoinedMonth)) {
    return row
  }

  if (isBefore(memberJoinedMonth, FEE_START)) {
    return row
  }

  if (isSameMonth(memberJoinedMonth, currentSheetMonth)) {
    row.monthlyCharges = 0
    row.newMemberFee = 1000
  } else if (isAfter(currentSheetMonth, memberJoinedMonth)) {
    row.monthlyCharges = 100
    row.newMemberFee = null
  }

  return row
}

function parsePeriodFromText(input: string): string | null {
  const normalized = normalizeHeader(input)

  const monthWordMatch = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[^\d]*(20\d{2})/i
  )
  if (monthWordMatch) {
    const token = monthWordMatch[1].toLowerCase()
    const year = Number(monthWordMatch[2])
    const month = MONTH_NAME_TO_INDEX[token]
    if (month) {
      return `${year}-${String(month).padStart(2, '0')}`
    }
  }

  const yearMonthMatch = normalized.match(/\b(20\d{2})[^\d]{0,3}(0?[1-9]|1[0-2])\b/)
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1])
    const month = Number(yearMonthMatch[2])
    return `${year}-${String(month).padStart(2, '0')}`
  }

  return null
}

function excelSerialToUtcDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569)
  return new Date(utcDays * 86400 * 1000)
}

function normalizeMonthJoined(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 30000) {
    const date = excelSerialToUtcDate(value)
    if (!Number.isNaN(date.valueOf())) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    }
  }

  const raw = toText(value)
  if (!raw) return null

  const fromText = parsePeriodFromText(raw)
  if (fromText) return fromText

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.valueOf())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`
  }

  return null
}

function isTotalContSheet(sheetName: string): boolean {
  return normalizeHeader(sheetName).includes('total cont')
}

function findHeaderIndex(indexByHeader: Record<string, number>, aliases: readonly string[]): number | null {
  for (const alias of aliases) {
    const key = normalizeHeader(alias)
    const index = indexByHeader[key]
    if (index !== undefined) return index
  }

  return null
}

function detectHeaderMap(rows: any[][]): { headerIndex: number; map: HeaderMap } | null {
  for (let i = 0; i < Math.min(rows.length, 8); i += 1) {
    const row = rows[i] || []
    const indexByHeader: Record<string, number> = {}

    row.forEach((cell, idx) => {
      const key = normalizeHeader(cell)
      if (key) indexByHeader[key] = idx
    })

    const map: HeaderMap = {
      sn: findHeaderIndex(indexByHeader, HEADER_ALIASES.sn) ?? -1,
      staffId: findHeaderIndex(indexByHeader, HEADER_ALIASES.staffId) ?? -1,
      name: findHeaderIndex(indexByHeader, HEADER_ALIASES.name) ?? -1,
      thriftSavings: findHeaderIndex(indexByHeader, HEADER_ALIASES.thriftSavings) ?? -1,
      specialSaving: findHeaderIndex(indexByHeader, HEADER_ALIASES.specialSaving) ?? -1,
      monthlyCharges: findHeaderIndex(indexByHeader, HEADER_ALIASES.monthlyCharges) ?? -1,
      newMemberFee: findHeaderIndex(indexByHeader, HEADER_ALIASES.newMemberFee) ?? -1,
      total: findHeaderIndex(indexByHeader, HEADER_ALIASES.total) ?? -1,
      monthJoined: findHeaderIndex(indexByHeader, HEADER_ALIASES.monthJoined) ?? -1,
    }

    const valid = Object.values(map).every((index) => index >= 0)
    if (valid) {
      return { headerIndex: i, map }
    }
  }

  return null
}

function parseSerial(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0) {
    return value
  }

  const raw = toText(value)
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return null

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseSheetRows(
  rows: any[][],
  sheetName: string,
  period: string,
  headerIndex: number,
  map: HeaderMap
): { rows: ParsedWorkbookRow[]; warnings: string[] } {
  const warnings: string[] = []
  const parsedRows: ParsedWorkbookRow[] = []

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || []

    const snRaw = row[map.sn]
    const snText = toText(snRaw)

    if (!snText) {
      if (parsedRows.length > 0) break
      continue
    }

    const serial = parseSerial(snRaw)
    if (serial === null) {
      warnings.push(`Skipped row ${i + 1} in "${sheetName}" (${monthLabel(period)}): invalid S/N.`)
      continue
    }

    const staffId = normalizeStaffId(row[map.staffId])
    if (!staffId) {
      warnings.push(`Skipped row ${i + 1} in "${sheetName}" (${monthLabel(period)}): empty Staff ID.`)
      continue
    }

    const name = toText(row[map.name])
    if (!name) {
      warnings.push(`Skipped row ${i + 1} in "${sheetName}" (${monthLabel(period)}): empty Name.`)
      continue
    }

    parsedRows.push({
      serial,
      staffId,
      name,
      thriftSavings: toNumber(row[map.thriftSavings]),
      specialSaving: toNumber(row[map.specialSaving]),
      monthlyCharges: toNumber(row[map.monthlyCharges]),
      newMemberFee: toNumber(row[map.newMemberFee]),
      excelTotal: toNumber(row[map.total]),
      monthJoinedRaw: toText(row[map.monthJoined]),
      monthJoinedPeriod: normalizeMonthJoined(row[map.monthJoined]),
      rowNumber: i + 1,
    })
  }

  return { rows: parsedRows, warnings }
}

function buildCanonicalMonths(
  months: Array<{ period: string; sheetName: string; rows: ParsedWorkbookRow[] }>
): ParseWorkbookResult {
  const globalWarnings: string[] = []
  const parsedMonths: ParsedMonth[] = []

  const sorted = [...months].sort((a, b) => a.period.localeCompare(b.period))

  for (const month of sorted) {
    const monthWarnings: string[] = []

    const canonicalRows = month.rows
      .sort((a, b) => a.serial - b.serial || a.staffId.localeCompare(b.staffId))
      .map((row) => {
        const feeRow: FeeRow = {
          monthlyCharges: row.monthlyCharges,
          newMemberFee: row.newMemberFee,
        }
        const memberJoinedMonth = row.monthJoinedPeriod
        const rawMonthJoined = row.monthJoinedRaw
        const joinParts = parseMonthParts(memberJoinedMonth)

        if (!joinParts) {
          monthWarnings.push(
            `Staff ${row.staffId} row ${row.rowNumber}: Month Joined blank or invalid; fee logic skipped.`
          )
        } else {
          const beforeCharges = feeRow.monthlyCharges
          const beforeNewMemberFee = feeRow.newMemberFee

          applyFeeLogic(feeRow, memberJoinedMonth, month.period)

          if (isSameMonth(memberJoinedMonth, month.period)) {
            if (beforeCharges !== feeRow.monthlyCharges) {
              monthWarnings.push(
                `Staff ${row.staffId} row ${row.rowNumber}: Monthly Charges ${beforeCharges ?? 0} normalized to ${feeRow.monthlyCharges ?? 0} for the joining month.`
              )
            }
            if (beforeNewMemberFee !== feeRow.newMemberFee) {
              monthWarnings.push(
                `Staff ${row.staffId} row ${row.rowNumber}: New Member FEE ${beforeNewMemberFee ?? 0} normalized to ${feeRow.newMemberFee ?? 0} for the joining month.`
              )
            }
          } else if (isAfter(month.period, memberJoinedMonth) && !isBefore(memberJoinedMonth, FEE_START)) {
            if (beforeCharges !== feeRow.monthlyCharges) {
              monthWarnings.push(
                `Staff ${row.staffId} row ${row.rowNumber}: Monthly Charges ${beforeCharges ?? 0} normalized to ${feeRow.monthlyCharges ?? 0} for the month after joining.`
              )
            }
            if (beforeNewMemberFee !== feeRow.newMemberFee) {
              monthWarnings.push(
                `Staff ${row.staffId} row ${row.rowNumber}: New Member FEE ${beforeNewMemberFee ?? 0} normalized to blank for the month after joining.`
              )
            }
          }
        }

        const total =
          row.thriftSavings +
          row.specialSaving +
          amountOrZero(feeRow.monthlyCharges) +
          amountOrZero(feeRow.newMemberFee)
        const variance = row.excelTotal > 0 ? Number((row.excelTotal - total).toFixed(2)) : 0
        const monthJoinedDisplay = joinParts ? monYear(memberJoinedMonth as string) : rawMonthJoined

        return {
          'S/N': row.serial,
          'Staff ID': row.staffId,
          Name: row.name,
          'Thrift Savings': row.thriftSavings,
          'Special Savings': row.specialSaving,
          Charges: feeRow.monthlyCharges,
          'New Member Fee': feeRow.newMemberFee,
          Total: total,
          'Expected Total': total,
          Variance: variance,
          'Member Type': amountOrZero(feeRow.newMemberFee) > 0 ? 'NEW' : 'OLD',
          'Month Joined': monthJoinedDisplay,
        } satisfies CanonicalMemberRow
      })

    parsedMonths.push({
      period: month.period,
      label: monthLabel(month.period),
      sheetName: month.sheetName,
      rows: canonicalRows,
      warnings: monthWarnings,
    })
  }

  return {
    months: parsedMonths,
    warnings: globalWarnings,
  }
}

function parseWorkbook(buffer: Buffer): ParseWorkbookResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const warnings: string[] = []

  const monthly = new Map<string, { period: string; sheetName: string; rows: ParsedWorkbookRow[] }>()

  for (const sheetNameRaw of workbook.SheetNames) {
    const sheetKey = String(sheetNameRaw ?? '')
    const sheetName = sheetKey.trim()
    if (!sheetName) continue

    if (isTotalContSheet(sheetName)) {
      warnings.push(`Skipped summary sheet "${sheetName}".`)
      continue
    }

    // Use the original sheet key to read the worksheet; the trimmed name is only for matching/logging.
    const ws = workbook.Sheets[sheetKey]
    if (!ws) continue

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

    const title = toText((rows[0] || [])[0])
    const period = parsePeriodFromText(sheetName) || parsePeriodFromText(title)
    if (!period) {
      warnings.push(`Skipped sheet "${sheetName}": could not parse month/year from sheet name or title.`)
      continue
    }

    const header = detectHeaderMap(rows)
    if (!header) {
      warnings.push(`Skipped sheet "${sheetName}" (${monthLabel(period)}): required headers were not found on row 2.`)
      continue
    }

    const parsed = parseSheetRows(rows, sheetName, period, header.headerIndex, header.map)
    warnings.push(...parsed.warnings)

    if (parsed.rows.length === 0) {
      warnings.push(`Skipped sheet "${sheetName}" (${monthLabel(period)}): no valid member rows found.`)
      continue
    }

    const existing = monthly.get(period)
    if (existing) {
      const merged = new Map<string, ParsedWorkbookRow>()
      for (const row of existing.rows) merged.set(row.staffId, row)
      for (const row of parsed.rows) merged.set(row.staffId, row)

      warnings.push(
        `Multiple sheets mapped to ${monthLabel(period)}. Merged rows from "${existing.sheetName}" and "${sheetName}" by Staff ID.`
      )

      monthly.set(period, {
        period,
        sheetName: `${existing.sheetName} + ${sheetName}`,
        rows: Array.from(merged.values()),
      })
      continue
    }

    monthly.set(period, {
      period,
      sheetName,
      rows: parsed.rows,
    })
  }

  const canonical = buildCanonicalMonths(Array.from(monthly.values()))

  return {
    months: canonical.months,
    warnings: [...warnings, ...canonical.warnings],
  }
}

function buildMemberEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  const safe = staffId.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase()
  return `${safe}@${domain.toLowerCase()}`
}

function parseJoinPeriodFromCanonicalRow(row: CanonicalMemberRow): string | null {
  return parsePeriodFromText(row['Month Joined'])
}

async function syncMembersToLatestMonth(months: ParsedMonth[]) {
  const sorted = [...months].sort((a, b) => a.period.localeCompare(b.period))
  const latest = sorted[sorted.length - 1]
  if (!latest) {
    return { syncedMembers: 0, suspendedMembers: 0, latestPeriod: null as string | null }
  }

  const thriftTotals = new Map<string, number>()
  const specialTotals = new Map<string, number>()

  for (const month of sorted) {
    for (const row of month.rows) {
      thriftTotals.set(row['Staff ID'], (thriftTotals.get(row['Staff ID']) || 0) + row['Thrift Savings'])
      specialTotals.set(row['Staff ID'], (specialTotals.get(row['Staff ID']) || 0) + row['Special Savings'])
    }
  }

  const latestStaffIds = Array.from(new Set(latest.rows.map((row) => row['Staff ID'])))

  let syncedMembers = 0
  let suspendedMembers = 0

  await prisma.$transaction(async (tx) => {
    for (const row of latest.rows) {
      const staffId = row['Staff ID']
      const joinPeriod = parseJoinPeriodFromCanonicalRow(row)
      const joinDate = joinPeriod ? new Date(`${joinPeriod}-01T00:00:00.000Z`) : null

      const baseEmail = buildMemberEmail(staffId)
      const existingEmailOwner = await tx.user.findUnique({
        where: { email: baseEmail },
        select: { id: true, staffId: true },
      })

      const email =
        existingEmailOwner && existingEmailOwner.staffId !== staffId
          ? `member-${staffId.toLowerCase()}@${(process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')}`
          : baseEmail

      const thriftBalance = thriftTotals.get(staffId) || 0
      const specialBalance = specialTotals.get(staffId) || 0

      await tx.user.upsert({
        where: { staffId },
        create: {
          staffId,
          name: row.Name,
          email,
          role: 'MEMBER',
          status: 'ACTIVE',
          monthlyContribution: row['Thrift Savings'],
          specialContribution: row['Special Savings'],
          balance: thriftBalance,
          specialBalance,
          totalContributions: thriftBalance + specialBalance,
          voucherEnabled: true,
          ...(joinDate ? { createdAt: joinDate } : {}),
        },
        update: {
          name: row.Name,
          monthlyContribution: row['Thrift Savings'],
          specialContribution: row['Special Savings'],
          balance: thriftBalance,
          specialBalance,
          totalContributions: thriftBalance + specialBalance,
          voucherEnabled: true,
          status: 'ACTIVE',
          ...(joinDate ? { createdAt: joinDate } : {}),
        },
      })

      syncedMembers += 1
    }

    const suspended = await tx.user.updateMany({
      where: {
        role: 'MEMBER',
        status: 'ACTIVE',
        OR: [{ staffId: null }, { staffId: { notIn: latestStaffIds } }],
      },
      data: {
        status: 'SUSPENDED',
        voucherEnabled: false,
      },
    })

    suspendedMembers = suspended.count
  })

  return {
    syncedMembers,
    suspendedMembers,
    latestPeriod: latest.period,
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.VIEW_MEMBER_DATA))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const months = await prisma.memberDataMonth.findMany({
    orderBy: { period: 'asc' },
    select: { period: true, label: true, rowCount: true, uploadedAt: true },
  })

  return NextResponse.json({ ok: true, months })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.IMPORT_MEMBERS))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const mode = String(formData.get('mode') || 'preview').trim().toLowerCase()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Please upload the Excel workbook.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = parseWorkbook(buffer)

  if (parsed.months.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Could not extract valid monthly sheets. Ensure row 1 is title, row 2 has standard headers, and member data starts below headers.',
      },
      { status: 400 }
    )
  }

  if (mode !== 'import') {
    const preview = parsed.months.map((month) => ({
      period: month.period,
      label: month.label,
      sheetName: month.sheetName,
      rowCount: month.rows.length,
      warnings: month.warnings.slice(0, 10),
      sampleRows: month.rows.slice(0, 8),
    }))

    return NextResponse.json({
      ok: true,
      mode: 'preview',
      columns: CANONICAL_COLUMNS,
      months: preview,
      warnings: parsed.warnings,
    })
  }

  const savedMonths: Array<{ period: string; label: string; rowCount: number; uploadedAt: Date; sheetName: string }> = []

  for (const month of parsed.months) {
    const saved = await prisma.memberDataMonth.upsert({
      where: { period: month.period },
      create: {
        period: month.period,
        label: month.label,
        rowCount: month.rows.length,
        columns: CANONICAL_COLUMNS as any,
        rows: month.rows as any,
        uploadedById: session.user.id,
        uploadedAt: new Date(),
      },
      update: {
        label: month.label,
        rowCount: month.rows.length,
        columns: CANONICAL_COLUMNS as any,
        rows: month.rows as any,
        uploadedById: session.user.id,
        uploadedAt: new Date(),
      },
      select: { period: true, label: true, rowCount: true, uploadedAt: true },
    })

    savedMonths.push({
      ...saved,
      sheetName: month.sheetName,
    })
  }

  const sync = await syncMembersToLatestMonth(parsed.months)

  return NextResponse.json({
    ok: true,
    mode: 'import',
    importedMonths: savedMonths.length,
    importedRows: savedMonths.reduce((sum, month) => sum + month.rowCount, 0),
    syncedMembers: sync.syncedMembers,
    suspendedMembers: sync.suspendedMembers,
    latestPeriod: sync.latestPeriod,
    months: savedMonths,
    warnings: parsed.warnings,
  })
}
