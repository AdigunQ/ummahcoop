import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import type { Prisma, PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import { getInitialMemberPassword } from '@/lib/default-member-password'

export const runtime = 'nodejs'

type CanonicalStyle = 'legacy' | 'combined'

type ParsedWorkbookRow = {
  serial: number
  staffId: string
  name: string
  rowNumber: number
  period: string
  monthText: string
  thriftSavings: number
  specialSaving: number
  monthlyCharges: number
  newMemberFee: number
  amount: number
  loan: number
  managementFee: number
  commodity: number
  excelTotal: number
  monthJoinedRaw: string
  monthJoinedPeriod: string | null // YYYY-MM
  style: CanonicalStyle
}

type CanonicalMemberRow = Record<string, string | number | null>
type ParsedMonth = {
  period: string
  label: string
  sheetName: string
  rows: CanonicalMemberRow[]
  warnings: string[]
  columns: string[]
  style: CanonicalStyle
}

type ParseWorkbookResult = {
  months: ParsedMonth[]
  columns: string[]
  warnings: string[]
}

type HeaderMap = Record<string, number>

type HeaderResult = {
  style: CanonicalStyle
  headerIndex: number
  map: HeaderMap
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

const LEGACY_HEADER_ALIASES = {
  sn: ['s/n', 'sn', 's no', 'serial no', 'serial number'],
  staffId: ['staff id'],
  name: ['name'],
  thriftSavings: ['thrift savings', 'monthly savings'],
  specialSaving: ['special saving', 'special savings'],
  monthlyCharges: ['monthly charges', 'charges', 'monthly fee'],
  newMemberFee: ['new member fee', 'form fee'],
  total: ['total'],
  monthJoined: ['month joined'],
} as const

const COMBINED_HEADER_ALIASES = {
  serial: ['s/n', 'sn', 's no'],
  staffId: ['employee no.', 'employee no', 'employee number', 'employee id', 'staff id'],
  name: ['employee name', 'name'],
  amount: ['amount'],
  month: ['month'],
  thriftSavings: ['monthly saving', 'monthly savings'],
  specialSaving: ['special saving', 'special savings'],
  loan: ['loan'],
  managementFee: ['management fee'],
  commodity: ['commodity'],
  monthlyCharges: ['monthly fee', 'monthly charges'],
  newMemberFee: ['form fee', 'new member fee'],
  total: ['total'],
} as const

const LEGACY_CANONICAL_COLUMNS = [
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
] as const

const COMBINED_CANONICAL_COLUMNS = [
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

function detectHeaderMap(rows: any[][]): HeaderResult | null {
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const row = rows[i] || []
    const indexByHeader: Record<string, number> = {}

    row.forEach((cell, idx) => {
      const key = normalizeHeader(cell)
      if (key) indexByHeader[key] = idx
    })

    const legacyMap: HeaderMap = {
      sn: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.sn) ?? -1,
      staffId: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.staffId) ?? -1,
      name: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.name) ?? -1,
      thriftSavings: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.thriftSavings) ?? -1,
      specialSaving: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.specialSaving) ?? -1,
      monthlyCharges: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.monthlyCharges) ?? -1,
      newMemberFee: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.newMemberFee) ?? -1,
      total: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.total) ?? -1,
      monthJoined: findHeaderIndex(indexByHeader, LEGACY_HEADER_ALIASES.monthJoined) ?? -1,
    }

    const legacyValid =
      legacyMap.sn >= 0 &&
      legacyMap.staffId >= 0 &&
      legacyMap.name >= 0 &&
      legacyMap.thriftSavings >= 0 &&
      legacyMap.specialSaving >= 0 &&
      legacyMap.monthlyCharges >= 0 &&
      legacyMap.newMemberFee >= 0 &&
      legacyMap.total >= 0

    if (legacyValid) {
      return { style: 'legacy', headerIndex: i, map: legacyMap }
    }

    const combinedMap: HeaderMap = {
      serial: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.serial) ?? -1,
      staffId: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.staffId) ?? -1,
      name: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.name) ?? -1,
      amount: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.amount) ?? -1,
      month: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.month) ?? -1,
      thriftSavings: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.thriftSavings) ?? -1,
      specialSaving: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.specialSaving) ?? -1,
      loan: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.loan) ?? -1,
      managementFee: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.managementFee) ?? -1,
      commodity: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.commodity) ?? -1,
      monthlyCharges: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.monthlyCharges) ?? -1,
      newMemberFee: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.newMemberFee) ?? -1,
      total: findHeaderIndex(indexByHeader, COMBINED_HEADER_ALIASES.total) ?? -1,
    }

    const combinedValid =
      combinedMap.staffId >= 0 &&
      combinedMap.name >= 0 &&
      combinedMap.amount >= 0 &&
      combinedMap.month >= 0 &&
      combinedMap.thriftSavings >= 0 &&
      combinedMap.specialSaving >= 0 &&
      combinedMap.loan >= 0 &&
      combinedMap.managementFee >= 0 &&
      combinedMap.commodity >= 0 &&
      combinedMap.monthlyCharges >= 0 &&
      combinedMap.newMemberFee >= 0 &&
      combinedMap.total >= 0

    if (combinedValid) {
      return { style: 'combined', headerIndex: i, map: combinedMap }
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

function isLikelyHeaderRow(row: any[], map: HeaderMap): boolean {
  const staffValue = normalizeHeader(toText(row[map.staffId]))
  if (!staffValue) return false

  if (staffValue.includes('employee no') || staffValue.includes('staff id') || staffValue === 's/n' || staffValue === 'sn') {
    return true
  }

  const monthValue = normalizeHeader(toText(row[map.month ?? -1]))
  return monthValue === 'month'
}

function parseLegacyRows(
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
      rowNumber: i + 1,
      period,
      monthText: monthLabel(period),
      thriftSavings: toNumber(row[map.thriftSavings]),
      specialSaving: toNumber(row[map.specialSaving]),
      monthlyCharges: toNumber(row[map.monthlyCharges]),
      newMemberFee: toNumber(row[map.newMemberFee]),
      amount: toNumber(row[map.thriftSavings]) + toNumber(row[map.specialSaving]),
      loan: 0,
      managementFee: 0,
      commodity: 0,
      excelTotal: toNumber(row[map.total]),
      monthJoinedRaw: map.monthJoined < 0 ? '' : toText(row[map.monthJoined]),
      monthJoinedPeriod: map.monthJoined < 0 ? null : normalizeMonthJoined(row[map.monthJoined]),
      style: 'legacy',
    })
  }

  return { rows: parsedRows, warnings }
}

function parseCombinedRows(
  rows: any[][],
  sheetName: string,
  map: HeaderMap,
  periodFromSheet: string
): { rows: ParsedWorkbookRow[]; warnings: string[] } {
  const warnings: string[] = []
  const parsedRows: ParsedWorkbookRow[] = []

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || []
    if (i === 0 && row.every((value) => normalizeHeader(value).length === 0)) continue

    const staffValue = toText(row[map.staffId])
    const monthValue = toText(row[map.month])

    if (!staffValue && !monthValue) {
      if (parsedRows.length > 0) break
      continue
    }
    if (isLikelyHeaderRow(row, map)) continue

    const staffId = normalizeStaffId(staffValue)
    if (!staffId) {
      warnings.push(`Skipped row ${i + 1} in "${sheetName}": empty or invalid Staff ID.`)
      continue
    }

    if (!monthValue) {
      warnings.push(`Skipped row ${i + 1} in "${sheetName}": missing month.`)
      continue
    }

    const period = parsePeriodFromText(monthValue)
    if (!period) {
      warnings.push(`Skipped row ${i + 1} in "${sheetName}": could not parse month "${monthValue}".`)
      continue
    }

    const serial = parseSerial(row[map.serial]) || parsedRows.length + 1
    const rowAmount = toNumber(row[map.amount])
    const thriftSavings = toNumber(row[map.thriftSavings])
    const specialSaving = toNumber(row[map.specialSaving])
    const monthlyFee = toNumber(row[map.monthlyCharges])
    const formFee = toNumber(row[map.newMemberFee])
    const loan = toNumber(row[map.loan])
    const managementFee = toNumber(row[map.managementFee])
    const commodity = toNumber(row[map.commodity])

    parsedRows.push({
      serial,
      staffId,
      name: toText(row[map.name]),
      rowNumber: i + 1,
      period,
      monthText: monthValue,
      thriftSavings,
      specialSaving,
      monthlyCharges: monthlyFee,
      newMemberFee: formFee,
      amount: rowAmount,
      loan,
      managementFee,
      commodity,
      excelTotal: toNumber(row[map.total]),
      monthJoinedRaw: '',
      monthJoinedPeriod: period,
      style: 'combined',
    })

    // Prefer sheet period for validation only if needed. No hard failure here because month column is authoritative.
    if (periodFromSheet && periodFromSheet !== period) {
      warnings.push(`Row ${i + 1} in "${sheetName}": month value "${monthValue}" does not match sheet period; using row month.`)
    }
  }

  return { rows: parsedRows, warnings }
}

function canonicalFromParsedRows(rows: ParsedWorkbookRow[], month: string, style: CanonicalStyle): {
  rows: CanonicalMemberRow[]
  warnings: string[]
} {
  const monthWarnings: string[] = []

  if (style === 'combined') {
    const canonicalRows = rows
      .map((row) => {
        const total =
          row.thriftSavings +
          row.specialSaving +
          row.monthlyCharges +
          row.newMemberFee +
          row.loan +
          row.managementFee +
          row.commodity

        return {
          'Employee No.': row.staffId,
          'Employee Name': row.name || '-',
          Amount: row.amount,
          Month: row.monthText,
          'Monthly Saving': row.thriftSavings,
          'Special Saving': row.specialSaving,
          Loan: row.loan,
          'Management Fee': row.managementFee,
          Commodity: row.commodity,
          'Monthly Fee': row.monthlyCharges,
          'Form Fee': row.newMemberFee,
          Total: row.excelTotal > 0 ? row.excelTotal : total,
        } satisfies CanonicalMemberRow
      })
      
    return { rows: canonicalRows, warnings: monthWarnings }
  }

  const canonicalRows = rows
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
        monthWarnings.push(`Staff ${row.staffId} row ${row.rowNumber}: Month Joined blank or invalid; fee logic skipped.`)
      } else {
        const beforeCharges = feeRow.monthlyCharges
        const beforeNewMemberFee = feeRow.newMemberFee

        applyFeeLogic(feeRow, memberJoinedMonth, month)

        if (isSameMonth(memberJoinedMonth, month)) {
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
        } else if (isAfter(month, memberJoinedMonth) && !isBefore(memberJoinedMonth, FEE_START)) {
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

  return { rows: canonicalRows, warnings: monthWarnings }
}

function buildCanonicalMonths(
  months: Array<{ period: string; sheetName: string; rows: ParsedWorkbookRow[]; style: CanonicalStyle }>
): ParseWorkbookResult {
  const globalWarnings: string[] = []
  const parsedMonths: ParsedMonth[] = []

  const sorted = [...months].sort((a, b) => a.period.localeCompare(b.period))

  for (const month of sorted) {
    const { rows, warnings } = canonicalFromParsedRows(month.rows, month.period, month.style)

    parsedMonths.push({
      period: month.period,
      label: monthLabel(month.period),
      sheetName: month.sheetName,
      rows,
      style: month.style,
      columns: month.style === 'combined' ? [...COMBINED_CANONICAL_COLUMNS] : [...LEGACY_CANONICAL_COLUMNS],
      warnings,
    })

    globalWarnings.push(...warnings)
  }

  const columns = Array.from(new Set(parsedMonths.flatMap((month) => month.columns)))

  return {
    months: parsedMonths,
    columns,
    warnings: globalWarnings,
  }
}

function parseWorkbook(buffer: Buffer): ParseWorkbookResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const warnings: string[] = []

  const monthly = new Map<string, { period: string; sheetName: string; rows: ParsedWorkbookRow[]; style: CanonicalStyle }>()

  for (const sheetNameRaw of workbook.SheetNames) {
    const sheetKey = String(sheetNameRaw ?? '')
    const sheetName = sheetKey.trim()
    if (!sheetName) continue

    if (isTotalContSheet(sheetName)) {
      warnings.push(`Skipped summary sheet "${sheetName}".`)
      continue
    }

    const ws = workbook.Sheets[sheetKey]
    if (!ws) continue

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]
    const detected = detectHeaderMap(rows)
    if (!detected) {
      warnings.push(`Skipped sheet "${sheetName}": required headers were not found.`)
      continue
    }

    const sheetPeriod = parsePeriodFromText(sheetName)
    const title = toText((rows[0] || [])[0])
    const titlePeriod = parsePeriodFromText(title)
    const defaultPeriod = sheetPeriod || titlePeriod

    const parsed =
      detected.style === 'legacy'
        ? parseLegacyRows(rows, sheetName, sheetPeriod || (titlePeriod || '2000-01'), detected.headerIndex, detected.map)
        : parseCombinedRows(rows, sheetName, detected.map, defaultPeriod || '')

    warnings.push(...parsed.warnings)

    if (parsed.rows.length === 0) {
      warnings.push(`Skipped sheet "${sheetName}": no valid member rows found.`)
      continue
    }

    if (detected.style === 'legacy') {
      const period = sheetPeriod || titlePeriod
      if (!period) {
        warnings.push(`Skipped legacy sheet "${sheetName}": could not parse month/year for import period.`)
        continue
      }

      const existing = monthly.get(period)
      if (existing && existing.style !== 'legacy') {
        warnings.push(`Mixed upload styles for ${monthLabel(period)}. Legacy sheet data overrides existing rows for this period.`)
      }

      const merged = new Map<string, ParsedWorkbookRow>()
      if (existing) {
        for (const row of existing.rows) {
          merged.set(row.staffId, row)
        }
      }
      for (const row of parsed.rows) merged.set(row.staffId, row)

      monthly.set(period, {
        period,
        sheetName: existing ? `${existing.sheetName} + ${sheetName}` : sheetName,
        rows: Array.from(merged.values()),
        style: 'legacy',
      })
      continue
    }

    // combined format: month is on every row and can span one or more periods per sheet.
    const grouped = new Map<string, ParsedWorkbookRow[]>()
    for (const row of parsed.rows) {
      if (!grouped.has(row.period)) grouped.set(row.period, [])
      grouped.get(row.period)!.push(row)
    }

    grouped.forEach((periodRows, period) => {
      const existing = monthly.get(period)
      const merged = new Map<string, ParsedWorkbookRow>()
      if (existing) {
        for (const row of existing.rows) merged.set(row.staffId, row)
      }
      for (const row of periodRows) merged.set(row.staffId, row)

      monthly.set(period, {
        period,
        sheetName: existing ? `${existing.sheetName} + ${sheetName}` : sheetName,
        rows: Array.from(merged.values()),
        style: 'combined',
      })
    })
  }

  const canonical = buildCanonicalMonths(Array.from(monthly.values()))

  return {
    months: canonical.months,
    columns: canonical.columns,
    warnings: [...warnings, ...canonical.warnings],
  }
}

function buildMemberEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  const safe = staffId.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase()
  return `${safe}@${domain.toLowerCase()}`
}

function parseJoinPeriodFromCanonicalRow(row: CanonicalMemberRow): string | null {
  const monthJoinedText = toText((row as any)['Month Joined'])
  if (monthJoinedText) {
    const monthJoined = parsePeriodFromText(monthJoinedText)
    if (monthJoined) return monthJoined
  }
  return null
}

function firstNonEmptyText(row: CanonicalMemberRow, keys: string[]): string {
  for (const key of keys) {
    const value = toText(row[key])
    if (value) return value
  }

  return ''
}

function firstNumber(row: CanonicalMemberRow, keys: string[]): number {
  for (const key of keys) {
    const value = row[key]
    const num = typeof value === 'number' ? value : Number(toText(value))
    if (Number.isFinite(num)) return num
  }

  return 0
}

async function syncMembersToLatestMonth(months: ParsedMonth[], tx: Prisma.TransactionClient | PrismaClient = prisma) {
  const sorted = [...months].sort((a, b) => a.period.localeCompare(b.period))
  const latest = sorted[sorted.length - 1]
  if (!latest) {
    return { syncedMembers: 0, suspendedMembers: 0, latestPeriod: null as string | null }
  }

  const thriftTotals = new Map<string, number>()
  const specialTotals = new Map<string, number>()
  const firstSeenMonth = new Map<string, string>()

  for (const month of sorted) {
    for (const row of month.rows) {
      const staffId = firstNonEmptyText(row, ['Staff ID', 'Employee No.'])
      if (!staffId) continue

      const thrift = firstNumber(row, ['Thrift Savings', 'Monthly Saving'])
      const special = firstNumber(row, ['Special Savings', 'Special Saving'])

      thriftTotals.set(staffId, (thriftTotals.get(staffId) || 0) + thrift)
      specialTotals.set(staffId, (specialTotals.get(staffId) || 0) + special)

      if (!firstSeenMonth.has(staffId)) {
        firstSeenMonth.set(staffId, month.period)
      }
    }
  }

  const latestStaffIds = Array.from(new Set(latest.rows.map((row) => firstNonEmptyText(row, ['Staff ID', 'Employee No.'])).filter(Boolean)))

  let syncedMembers = 0
  let suspendedMembers = 0

  for (const row of latest.rows) {
    const staffId = firstNonEmptyText(row, ['Staff ID', 'Employee No.'])
    if (!staffId) continue

    const name = firstNonEmptyText(row, ['Name', 'Employee Name']) || '-'
    const monthlyContribution = firstNumber(row, ['Thrift Savings', 'Monthly Saving'])
    const specialContribution = firstNumber(row, ['Special Savings', 'Special Saving'])

    const thriftBalance = thriftTotals.get(staffId) || 0
    const specialBalance = specialTotals.get(staffId) || 0
    const passwordHash = await bcrypt.hash(getInitialMemberPassword(staffId), 10)

    const joinPeriod = parseJoinPeriodFromCanonicalRow(row) || firstSeenMonth.get(staffId) || null
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

    const existingMember = await tx.user.findUnique({
      where: { staffId },
      select: { id: true, password: true },
    })

    if (existingMember) {
      await tx.user.update({
        where: { id: existingMember.id },
        data: {
          name,
          monthlyContribution,
          specialContribution,
          balance: thriftBalance,
          specialBalance,
          totalContributions: thriftBalance + specialBalance,
          voucherEnabled: true,
          status: 'ACTIVE',
          ...(existingMember.password ? {} : { password: passwordHash }),
          ...(joinDate ? { createdAt: joinDate } : {}),
        },
      })
    } else {
      await tx.user.create({
        data: {
          staffId,
          name,
          email,
          password: passwordHash,
          role: 'MEMBER',
          status: 'ACTIVE',
          monthlyContribution,
          specialContribution,
          balance: thriftBalance,
          specialBalance,
          totalContributions: thriftBalance + specialBalance,
          voucherEnabled: true,
          ...(joinDate ? { createdAt: joinDate } : {}),
        },
      })
    }

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
          'Could not extract valid monthly data. Ensure the workbook has readable month columns and at least one member row.',
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
      columns: parsed.columns,
      months: preview,
      warnings: parsed.warnings,
    })
  }

  type ImportedMonth = { period: string; label: string; rowCount: number; uploadedAt: Date; sheetName: string; columns: string[] }

  const { savedMonths, syncResult } = await prisma.$transaction(async (tx) => {
    await tx.memberDataMonth.deleteMany({})
    const createdMonths: ImportedMonth[] = []

    for (const month of parsed.months) {
      const created = await tx.memberDataMonth.create({
        data: {
          period: month.period,
          label: month.label,
          rowCount: month.rows.length,
          columns: month.columns as any,
          rows: month.rows as any,
          uploadedById: session.user.id,
          uploadedAt: new Date(),
        },
        select: { period: true, label: true, rowCount: true, uploadedAt: true },
      })

      createdMonths.push({
        ...created,
        sheetName: month.sheetName,
        columns: month.columns,
      })
    }

    const syncResult = await syncMembersToLatestMonth(parsed.months, tx)

    return {
      savedMonths: createdMonths,
      syncResult,
    }
  })

  return NextResponse.json({
    ok: true,
    mode: 'import',
    importedMonths: savedMonths.length,
    importedRows: savedMonths.reduce((sum, month) => sum + month.rowCount, 0),
    syncedMembers: syncResult.syncedMembers,
    suspendedMembers: syncResult.suspendedMembers,
    latestPeriod: syncResult.latestPeriod,
    months: savedMonths,
    warnings: parsed.warnings,
  })
}
