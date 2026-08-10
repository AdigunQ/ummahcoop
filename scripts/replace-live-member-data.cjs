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

const canonicalColumns = [
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

function makeSnapshotRow(row, monthLabel, period, joinedPeriod) {
  // The source workbook packs optional values left-to-right. Column D is S/No,
  // while the real savings amount begins in column E. Reconstruct the canonical
  // fields instead of trusting the misleading header position for every row.
  const thrift = number(row[4])
  const packedFirst = number(row[5])
  const packedSecond = number(row[6])
  const packedThird = number(row[7])
  const packedFourth = number(row[8])
  const isJoiningMonth = joinedPeriod === period
  const feeEligible = isJoiningMonth && period >= '2026-02'
  const special = packedFirst > 1000 ? packedFirst : 0
  const charges = isJoiningMonth ? 0 : 100
  const newMember = feeEligible ? 1000 : 0
  const loan = packedThird > 1000 ? packedThird : packedSecond > 1000 && packedSecond !== 1000 ? packedSecond : 0
  const commodity = packedFourth > 0 ? packedFourth : 0
  const total = thrift + special + charges + newMember + loan + commodity
  const id = staffId(row[1])
  const name = text(row[2])

  return {
    'Employee No.': id,
    'Employee Name': name,
    Amount: thrift + special,
    Month: monthLabel,
    'Month Joined': joinedPeriod ? monthMap.get(joinedPeriod)?.label || joinedPeriod : '',
    'Monthly Saving': thrift,
    'Special Saving': special,
    Loan: loan,
    'Management Fee': 0,
    Commodity: commodity,
    'Monthly Fee': charges,
    'Form Fee': newMember,
    Total: total,
    'Member Type': newMember > 0 ? 'NEW' : 'OLD',
  }
}

function readWorkbook() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`)
  const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellDates: true, raw: true })
  const rawMonths = []
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
    const rawRows = []
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

      rawRows.push(row)
      allIds.add(id)
      if (!firstSeen.has(id)) firstSeen.set(id, meta.period)
    }

    if (rawRows.length === 0) throw new Error(`No member rows found in ${sheetName}.`)
    rawMonths.push({ ...meta, sheetName, rows: rawRows })
  }

  rawMonths.sort((a, b) => a.period.localeCompare(b.period))
  if (rawMonths.length !== 10) throw new Error(`Expected 10 populated source sheets, found ${rawMonths.length}.`)

  for (const month of rawMonths) {
    const parsedRows = month.rows.map((row) => {
      const id = staffId(row[1])
      const snapshotRow = makeSnapshotRow(row, month.label, month.period, firstSeen.get(id))
      thriftTotals.set(id, (thriftTotals.get(id) || 0) + snapshotRow['Monthly Saving'])
      specialTotals.set(id, (specialTotals.get(id) || 0) + snapshotRow['Special Saving'])
      return snapshotRow
    })
    months.push({ ...month, rows: parsedRows })
  }

  const latest = months[months.length - 1]
  const augustRows = latest.rows.map((row) => {
    const total = row['Monthly Saving'] + row['Special Saving'] + 100 + row.Loan + row.Commodity
    return {
      ...row,
      Month: 'Aug 2026',
      'Monthly Fee': 100,
      'Form Fee': 0,
      Total: total,
      'Member Type': 'OLD',
    }
  })
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
      feeAudit: parsed.months.map((month) => ({
        period: month.period,
        rows: month.rows.length,
        monthlyFees: [...new Set(month.rows.map((row) => row['Monthly Fee']))].sort((a, b) => a - b),
        formFees: [...new Set(month.rows.map((row) => row['Form Fee']))].sort((a, b) => a - b),
        memberTypes: {
          new: month.rows.filter((row) => row['Member Type'] === 'NEW').length,
          old: month.rows.filter((row) => row['Member Type'] === 'OLD').length,
        },
      })),
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
          columns: canonicalColumns,
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
          monthlyContribution: row['Monthly Saving'],
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
