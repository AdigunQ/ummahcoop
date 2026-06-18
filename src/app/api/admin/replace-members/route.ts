import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { getInitialMemberPassword } from '@/lib/default-member-password'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

export const runtime = 'nodejs'

type ImportMember = {
  staffId: string
  name: string
  monthlySavings: number
  specialSavings: number
  phone?: string
  joinedAt?: string // YYYY-MM-DD
  warnings: string[]
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .trim()
  if (!cleaned) return 0
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function toText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeStaffId(value: unknown): string {
  // Staff IDs in the spreadsheets are typically 6 digits with leading zeros.
  // Excel sometimes coerces them into numbers, which would drop the leading zeros.
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

function excelSerialToUtcDate(serial: number): Date {
  // Excel stores dates as days since 1900-01-00. The 25569 offset brings us to 1970-01-01.
  const utcDays = Math.floor(serial - 25569)
  return new Date(utcDays * 86400 * 1000)
}

function parseJoinDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value

  if (typeof value === 'number' && Number.isFinite(value) && value > 30000) {
    const date = excelSerialToUtcDate(value)
    return Number.isNaN(date.valueOf()) ? null : date
  }

  const raw = toText(value)
  if (!raw) return null

  const cleaned = raw
    .toLowerCase()
    .replace(/^0ctober/, 'october')
    .replace(/^0ct/, 'oct')
    .replace(/\s+/g, ' ')
    .trim()

  // dd/mm/yyyy or dd-mm-yyyy
  const m1 = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m1) {
    const day = Number(m1[1])
    const month = Number(m1[2])
    const year = Number(m1[3])
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day))
    }
  }

  // "october 2025" / "oct 2025"
  const m2 = cleaned.match(/^([a-z]{3,9})\s+(\d{4})$/)
  if (m2) {
    const monthToken = m2[1]
    const year = Number(m2[2])
    const months: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    }
    const monthIndex = months[monthToken]
    if (monthIndex !== undefined && year >= 2000) {
      return new Date(Date.UTC(year, monthIndex, 1))
    }
  }

  const parsed = new Date(cleaned)
  if (!Number.isNaN(parsed.valueOf())) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
  }

  return null
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function findColumnIndex(indexByHeader: Record<string, number>, candidates: string[]): number | undefined {
  for (let i = 0; i < candidates.length; i += 1) {
    const key = normalizeHeader(candidates[i])
    const index = indexByHeader[key]
    if (index !== undefined) return index
  }
  return undefined
}

function detectHeaderRow(
  rows: any[][],
  candidates: { staff: string[]; name: string[]; thrift: string[] }
): { headerIndex: number; indexByHeader: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const row = rows[i] || []
    const indexByHeader: Record<string, number> = {}
    row.forEach((cell, idx) => {
      const key = normalizeHeader(cell)
      if (key) indexByHeader[key] = idx
    })

    const staffIdIdx = findColumnIndex(indexByHeader, candidates.staff)
    const nameIdx = findColumnIndex(indexByHeader, candidates.name)
    const thriftIdx = findColumnIndex(indexByHeader, candidates.thrift)

    if (staffIdIdx !== undefined && nameIdx !== undefined && thriftIdx !== undefined) {
      return { headerIndex: i, indexByHeader }
    }
  }

  return null
}

function chooseSheet(wb: XLSX.WorkBook): { sheetName: string; rows: any[][]; headerIndex: number; indexByHeader: Record<string, number> } {
  const preferredSheet = wb.SheetNames.find((name) => normalizeHeader(name) === 'feb 2026')

  const candidates = {
    staff: ['staff id', 'employee no.', 'employee no', 'employee number', 'employee id'],
    name: ['name', 'employee name', 'full name'],
    thrift: ['thrift savings', 'monthly savings', 'savings (monthly)', 'monthly contribution', 'monthly savings amount'],
  }

  const eligible: Array<{
    sheetName: string
    rows: any[][]
    headerIndex: number
    indexByHeader: Record<string, number>
    dataRows: number
    orderIndex: number
  }> = []

  for (let s = 0; s < wb.SheetNames.length; s += 1) {
    const sheetName = wb.SheetNames[s]
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]
    const header = detectHeaderRow(rows, candidates)
    if (!header) continue

    const staffIdx = findColumnIndex(header.indexByHeader, candidates.staff)
    const dataRows = rows.slice(header.headerIndex + 1).filter((row) => normalizeStaffId((row || [])[staffIdx || 0])).length

    eligible.push({
      sheetName,
      rows,
      headerIndex: header.headerIndex,
      indexByHeader: header.indexByHeader,
      dataRows,
      orderIndex: s,
    })
  }

  if (eligible.length === 0) {
    throw new Error('Excel import: could not find a sheet containing Staff ID, Name, and Thrift Savings columns.')
  }

  eligible.sort((a, b) => {
    if (preferredSheet) {
      if (a.sheetName === preferredSheet && b.sheetName !== preferredSheet) return -1
      if (b.sheetName === preferredSheet && a.sheetName !== preferredSheet) return 1
    }

    if (b.dataRows !== a.dataRows) return b.dataRows - a.dataRows
    return b.orderIndex - a.orderIndex
  })

  const chosen = eligible[0]
  return {
    sheetName: chosen.sheetName,
    rows: chosen.rows,
    headerIndex: chosen.headerIndex,
    indexByHeader: chosen.indexByHeader,
  }
}

function parseMembersWorkbook(buffer: Buffer): { sheetName: string; members: ImportMember[]; globalWarnings: string[] } {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const chosen = chooseSheet(wb)

  const staffCandidates = ['staff id', 'employee no.', 'employee no', 'employee number', 'employee id']
  const nameCandidates = ['name', 'employee name', 'full name']
  const thriftCandidates = ['thrift savings', 'monthly savings', 'savings (monthly)', 'monthly contribution', 'monthly savings amount']
  const specialCandidates = ['special saving', 'special savings', 'special (monthly)']
  const phoneCandidates = ['phone', 'phone number', 'mobile', 'whatsapp', 'whatsapp number']
  const joinedCandidates = ['month joined', 'joined', 'join date', 'date joined']
  const chargesCandidates = ['monthly charges', 'charges']
  const newMemberCandidates = ['new member fee', 'new member', 'new member fee']
  const totalCandidates = ['total']

  const staffIdIdx = findColumnIndex(chosen.indexByHeader, staffCandidates)
  const nameIdx = findColumnIndex(chosen.indexByHeader, nameCandidates)
  const thriftIdx = findColumnIndex(chosen.indexByHeader, thriftCandidates)
  const specialIdx = findColumnIndex(chosen.indexByHeader, specialCandidates)
  const phoneIdx = findColumnIndex(chosen.indexByHeader, phoneCandidates)
  const joinedIdx = findColumnIndex(chosen.indexByHeader, joinedCandidates)
  const chargesIdx = findColumnIndex(chosen.indexByHeader, chargesCandidates)
  const newMemberIdx = findColumnIndex(chosen.indexByHeader, newMemberCandidates)
  const totalIdx = findColumnIndex(chosen.indexByHeader, totalCandidates)

  if (staffIdIdx === undefined || nameIdx === undefined || thriftIdx === undefined) {
    throw new Error(`Excel import: required columns are missing in sheet "${chosen.sheetName}".`)
  }

  const globalWarnings: string[] = []
  if (specialIdx === undefined) globalWarnings.push('No Special Saving column detected; special savings will be imported as ₦0 for everyone.')
  if (joinedIdx === undefined) globalWarnings.push('No Month Joined column detected; join dates will default to 2025-10-01.')
  if (chargesIdx !== undefined) globalWarnings.push('Charges column detected. Ignored by importer.')
  if (newMemberIdx !== undefined) globalWarnings.push('New Member fee column detected. Ignored by importer (fees are computed by join date).')
  if (totalIdx !== undefined) globalWarnings.push('Total column detected. Ignored by importer (we use Thrift + Special only).')

  const members: ImportMember[] = []
  const seen = new Set<string>()
  let joinParsed = 0
  let mod100Count = 0
  let amountCount = 0

  for (let i = chosen.headerIndex + 1; i < chosen.rows.length; i += 1) {
    const row = chosen.rows[i] || []
    const staffId = normalizeStaffId(row[staffIdIdx])
    if (!staffId) continue
    if (seen.has(staffId)) {
      throw new Error(`Duplicate Staff ID found in Excel: ${staffId}`)
    }
    seen.add(staffId)

    const name = toText(row[nameIdx]) || 'Unnamed Member'
    const monthlySavings = toNumber(row[thriftIdx])
    const specialSavings = specialIdx === undefined ? 0 : toNumber(row[specialIdx])
    const phone = phoneIdx === undefined ? '' : toText(row[phoneIdx])
    const joinDate = joinedIdx === undefined ? null : parseJoinDate(row[joinedIdx])
    if (joinDate) joinParsed += 1

    if (monthlySavings > 0) {
      amountCount += 1
      if (monthlySavings % 1000 === 100) mod100Count += 1
    }

    const warnings: string[] = []
    if (monthlySavings <= 0 && specialSavings <= 0) warnings.push('Monthly + special savings are ₦0')
    if (joinedIdx !== undefined && !joinDate) warnings.push('Month Joined is missing/invalid')

    const now = new Date()
    if (joinDate && joinDate.valueOf() > now.valueOf()) warnings.push('Join date is in the future')

    members.push({
      staffId,
      name,
      monthlySavings,
      specialSavings,
      phone: phone || undefined,
      joinedAt: joinDate ? isoDateOnly(joinDate) : undefined,
      warnings,
    })
  }

  members.sort((a, b) => a.staffId.localeCompare(b.staffId))

  if (amountCount > 10) {
    const ratio = mod100Count / amountCount
    if (ratio >= 0.6) {
      globalWarnings.push(
        'Many Thrift Savings values end with 100. Ensure the column is monthly savings (not totals including fees).'
      )
    }
  }

  if (joinedIdx !== undefined) {
    globalWarnings.push(`Parsed join dates for ${joinParsed}/${members.length} members.`)
  }

  return { sheetName: chosen.sheetName, members, globalWarnings }
}

function buildEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  const local = staffId.trim().replace(/[^a-zA-Z0-9._-]/g, '')
  if (!local) {
    throw new Error(`Invalid Staff ID for email generation: "${staffId}"`)
  }
  return `${local.toLowerCase()}@${domain.toLowerCase()}`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.IMPORT_MEMBERS))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const mode = String(formData.get('mode') || 'preview')
  const file = formData.get('file') || formData.get('members') || formData.get('special') || formData.get('savings')

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Please upload the Excel file.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = parseMembersWorkbook(buffer)
  const merged = parsed.members

  const duplicates = merged.filter((m) => !m.staffId).length
  if (duplicates > 0) {
    return NextResponse.json({ ok: false, error: 'One or more rows are missing Staff ID.' }, { status: 400 })
  }

  const withSpecial = merged.filter((m) => m.specialSavings > 0).length
  const joinDates = merged.filter((m) => Boolean(m.joinedAt)).length
  const warningRows = merged.filter((m) => (m.warnings || []).length > 0).length

  if (mode !== 'replace') {
    return NextResponse.json({
      ok: true,
      mode: 'preview',
      sheetName: parsed.sheetName,
      globalWarnings: parsed.globalWarnings,
      counts: {
        members: merged.length,
        withSpecialSavings: withSpecial,
        joinDates,
        warningRows,
      },
      sample: merged.slice(0, 8),
    })
  }

  const confirm = String(formData.get('confirm') || '')
  if (confirm !== 'REPLACE MEMBERS') {
    return NextResponse.json({ ok: false, error: 'Confirmation text must be exactly: REPLACE MEMBERS' }, { status: 400 })
  }

  const fallbackCreatedAt = new Date('2025-10-01T00:00:00.000Z')

  const data = await Promise.all(
    merged.map(async (member) => ({
      email: buildEmail(member.staffId),
      name: member.name,
      staffId: member.staffId,
      password: await bcrypt.hash(getInitialMemberPassword(member.staffId), 10),
      role: 'MEMBER' as const,
      status: 'ACTIVE' as const,
      phone: member.phone || null,
      department: null,
      monthlyContribution: member.monthlySavings,
      specialContribution: member.specialSavings,
      balance: 0,
      specialBalance: 0,
      voucherEnabled: true,
      createdAt: member.joinedAt ? new Date(`${member.joinedAt}T00:00:00.000Z`) : fallbackCreatedAt,
    }))
  )

  // hard-fail on duplicate emails or staff IDs before deleting anything
  const staffIdSet = new Set<string>()
  const emailSet = new Set<string>()
  for (const row of data) {
    if (staffIdSet.has(row.staffId || '')) throw new Error(`Duplicate Staff ID detected: ${row.staffId}`)
    staffIdSet.add(row.staffId || '')
    if (emailSet.has(row.email)) throw new Error(`Duplicate generated email detected: ${row.email}`)
    emailSet.add(row.email)
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.user.deleteMany({ where: { role: 'MEMBER' } })
    const created = await tx.user.createMany({ data })
    return { deletedMembers: deleted.count, createdMembers: created.count }
  })

  return NextResponse.json({
    ok: true,
    mode: 'replace',
    importedFromSheet: parsed.sheetName,
    ...result,
    defaultMemberLogin: {
      emailPattern: `<staffId>@${(process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')}`,
    },
  })
}
