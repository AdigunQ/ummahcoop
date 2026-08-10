const fs = require('node:fs')
const path = require('node:path')
const XLSX = require('xlsx')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const workbookPath = process.argv[2] || path.resolve(process.cwd(), 'data', '1 REAL DATA.xlsx')
const dryRun = process.argv.includes('--dry-run')

const monthMap = new Map([
  ['oct-2025', { period: '2025-10', label: 'Oct 2025' }],
  ['nov-2025', { period: '2025-11', label: 'Nov 2025' }],
  ['dec-2025', { period: '2025-12', label: 'Dec 2025' }],
  ['jan-2026', { period: '2026-01', label: 'Jan 2026' }],
  ['feb-2026', { period: '2026-02', label: 'Feb 2026' }],
  ['march 26', { period: '2026-03', label: 'Mar 2026' }],
  ['april 26', { period: '2026-04', label: 'Apr 2026' }],
  ['may 26', { period: '2026-05', label: 'May 2026' }],
  ['june', { period: '2026-06', label: 'Jun 2026' }],
  ['july', { period: '2026-07', label: 'Jul 2026' }],
])

const sourceColumns = [
  'S/No',
  'Employee No.',
  'Employee Name',
  'Thrift Savings',
  'Special Saving',
  'Charges',
  'New Member',
  'Loan',
  'Commodity',
  'Total',
]

function text(value) {
  return String(value ?? '').trim()
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(text(value).replace(/[,₦\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function staffId(value) {
  const raw = text(value).replace(/\s+/g, '')
  if (!raw) return ''
  return /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw
}

function dateFor(period) {
  return new Date(`${period}-01T00:00:00.000Z`)
}

function initialPassword(id) {
  return (process.env.DEFAULT_MEMBER_PASSWORD || id).trim().toUpperCase()
}

function buildEmail(id, suffix = '') {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  return `${suffix}${id.toLowerCase()}@${domain.toLowerCase()}`
}

function makeSnapshotRow(row, monthLabel) {
  const thrift = number(row[3])
  const special = number(row[4])
  const charges = number(row[5])
  const newMember = number(row[6])
  const loan = number(row[7])
  const commodity = number(row[8])
  const total = thrift + special + charges + newMember + loan + commodity
  const id = staffId(row[1])
  const name = text(row[2])

  return {
    // Original workbook fields.
    'S/No': Number(text(row[0])),
    'Employee No.': id,
    'Employee Name': name,
    'Thrift Savings': thrift,
    'Special Saving': special,
    Charges: charges,
    'New Member': newMember,
    Loan: loan,
    Commodity: commodity,
    Total: total,
    // Compatibility aliases used by the existing reports and member views.
    Amount: thrift + special,
    Month: monthLabel,
    'Monthly Saving': thrift,
    'Management Fee': 0,
    'Monthly Fee': charges,
    'Form Fee': newMember,
  }
}

function readWorkbook() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`)
  const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellDates: true, raw: true })
  const months = []
  const allIds = new Set()
  const firstSeen = new Map()
  const thriftTotals = new Map()
  const specialTotals = new Map()

  for (const rawSheetName of workbook.SheetNames) {
    const sheetName = text(rawSheetName)
    const key = sheetName.toLowerCase()
    if (key === 'summary' || key === 'august') continue

    const meta = monthMap.get(key)
    if (!meta) throw new Error(`Unrecognized populated sheet: ${sheetName}`)

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[rawSheetName], {
      header: 1,
      raw: true,
      defval: '',
    })
    const header = (rows[0] || []).slice(0, sourceColumns.length).map(text)
    if (sourceColumns.some((value, index) => header[index] !== value)) {
      throw new Error(`Header mismatch in ${sheetName}: ${header.join(' | ')}`)
    }

    const seen = new Set()
    const parsedRows = []
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index] || []
      const serialText = text(row[0])
      const rawStaffId = text(row[1])
      const name = text(row[2])
      if (!serialText && !rawStaffId && !name) continue
      if (!/^\d+$/.test(serialText)) throw new Error(`${sheetName} row ${index + 1}: S/No must be an integer.`)

      const id = staffId(row[1])
      if (!id) throw new Error(`${sheetName} row ${index + 1}: Staff ID is empty.`)
      if (!name) throw new Error(`${sheetName} row ${index + 1}: Employee Name is empty.`)
      if (seen.has(id)) throw new Error(`${sheetName} row ${index + 1}: duplicate Staff ID ${id}.`)
      seen.add(id)

      const snapshotRow = makeSnapshotRow(row, meta.label)
      parsedRows.push(snapshotRow)
      allIds.add(id)
      if (!firstSeen.has(id)) firstSeen.set(id, meta.period)
      thriftTotals.set(id, (thriftTotals.get(id) || 0) + snapshotRow['Thrift Savings'])
      specialTotals.set(id, (specialTotals.get(id) || 0) + snapshotRow['Special Saving'])
    }

    if (parsedRows.length === 0) throw new Error(`No member rows found in ${sheetName}.`)
    months.push({ ...meta, sheetName, rows: parsedRows })
  }

  months.sort((a, b) => a.period.localeCompare(b.period))
  if (months.length !== 10) throw new Error(`Expected 10 populated source sheets, found ${months.length}.`)

  const latest = months[months.length - 1]
  const augustRows = latest.rows.map((row) => ({ ...row, Month: 'Aug 2026' }))
  months.push({
    period: '2026-08',
    label: 'Aug 2026',
    sheetName: 'July (carried forward to Aug 2026)',
    rows: augustRows,
  })

  return { months, latest: months[months.length - 1], allIds, firstSeen, thriftTotals, specialTotals }
}

async function main() {
  const parsed = readWorkbook()
  const latestIds = new Set(parsed.latest.rows.map((row) => row['Employee No.']))
  const prisma = new PrismaClient()

  try {
    const current = await prisma.user.count({ where: { role: 'MEMBER' } })
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
    if (!admin) throw new Error('No admin account exists to attribute the imported snapshots.')

    const summary = {
      dryRun,
      sourceWorkbook: workbookPath,
      sourceSheets: parsed.months.slice(0, -1).map((month) => ({ sheet: month.sheetName, period: month.period, rows: month.rows.length })),
      generatedSheet: { sheet: parsed.latest.sheetName, period: parsed.latest.period, rows: parsed.latest.rows.length },
      importedRows: parsed.months.reduce((sum, month) => sum + month.rows.length, 0),
      uniqueStaffIdsAcrossHistory: parsed.allIds.size,
      currentDatabaseMembers: current,
      latestMemberCount: latestIds.size,
      skipSheets: ['Summary', 'August'],
      preservedTables: ['admins', 'loans', 'repayments', 'payments', 'transactions', 'commodity_requests', 'withdrawals', 'member_privileges', 'vouchers', 'payroll_cycles', 'payroll_lines'],
    }

    if (dryRun) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.memberDataMonth.deleteMany({})

      const uploadedAt = new Date()
      await tx.memberDataMonth.createMany({
        data: parsed.months.map((month) => ({
          period: month.period,
          label: month.label,
          rowCount: month.rows.length,
          columns: sourceColumns,
          rows: month.rows,
          uploadedById: admin.id,
          uploadedAt,
        })),
      })

      let createdMembers = 0
      let updatedMembers = 0
      for (const row of parsed.latest.rows) {
        const id = row['Employee No.']
        const existing = await tx.user.findUnique({ where: { staffId: id } })
        const joinPeriod = parsed.firstSeen.get(id)
        const memberData = {
          name: row['Employee Name'],
          monthlyContribution: row['Thrift Savings'],
          specialContribution: row['Special Saving'],
          balance: parsed.thriftTotals.get(id) || 0,
          specialBalance: parsed.specialTotals.get(id) || 0,
          totalContributions: (parsed.thriftTotals.get(id) || 0) + (parsed.specialTotals.get(id) || 0),
          status: 'ACTIVE',
          voucherEnabled: true,
          ...(joinPeriod ? { createdAt: dateFor(joinPeriod) } : {}),
        }

        if (existing) {
          await tx.user.update({ where: { id: existing.id }, data: memberData })
          updatedMembers += 1
          continue
        }

        let email = buildEmail(id)
        const emailOwner = await tx.user.findUnique({ where: { email } })
        if (emailOwner) email = buildEmail(id, 'member-')

        await tx.user.create({
          data: {
            ...memberData,
            email,
            staffId: id,
            password: await bcrypt.hash(initialPassword(id), 10),
            role: 'MEMBER',
          },
        })
        createdMembers += 1
      }

      const suspended = await tx.user.updateMany({
        where: {
          role: 'MEMBER',
          OR: [{ staffId: null }, { staffId: { notIn: Array.from(latestIds) } }],
        },
        data: { status: 'SUSPENDED', voucherEnabled: false },
      })

      return { createdMembers, updatedMembers, suspendedMembers: suspended.count }
    }, { maxWait: 15000, timeout: 120000 })

    console.log(JSON.stringify({ ...summary, dryRun: false, ...result }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
