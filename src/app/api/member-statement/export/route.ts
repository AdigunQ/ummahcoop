import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LOAN_REQUEST_POLICY } from '@/lib/loan-request'
import { buildVoucherDataset, firstVoucherPeriodForCreatedAt, resolveVoucherPeriod } from '@/lib/vouchers'

function normalizeStaffId(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
}

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '')
  const escapedForSpreadsheet = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  if (/["\n,]/.test(escapedForSpreadsheet)) {
    return `"${escapedForSpreadsheet.replace(/"/g, '""')}"`
  }
  return escapedForSpreadsheet
}

function safeNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function nextPeriod(current: string): string {
  const [yearText, monthText] = current.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return current

  const nextMonth = month + 1
  const nextYear = nextMonth === 13 ? year + 1 : year
  const normalizedMonth = nextMonth === 13 ? 1 : nextMonth

  return `${nextYear}-${String(normalizedMonth).padStart(2, '0')}`
}

function buildSavingsHeader(): string[] {
  return [
    'Section',
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
  ]
}

function buildLoanHeader(): string[] {
  return [
    'Section',
    'Date',
    'Employee No.',
    'Employee Name',
    'Loan Amount',
    'Purpose',
    'Duration Months',
    'Interest Rate (%)',
    'Admin Charge',
    'Status',
    'Balance',
  ]
}

function buildCommodityHeader(): string[] {
  return [
    'Section',
    'Date',
    'Employee No.',
    'Employee Name',
    'Item',
    'Preferred Budget',
    'Status',
    'Admin Quote',
    'Repayment Plan (months)',
    'Notes',
  ]
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'MEMBER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      staffId: true,
      createdAt: true,
    },
  })

  if (!user?.staffId) {
    return NextResponse.json({ error: 'Staff ID missing' }, { status: 400 })
  }

  const staffId = user.staffId
  const normalizedStaffId = normalizeStaffId(staffId)
  const targetName = user.name || staffId

  const startPeriod = firstVoucherPeriodForCreatedAt(user.createdAt)
  const endPeriod = resolveVoucherPeriod().period

  const savingsRows = [] as Array<{
    period: string
    thriftSavings: number
    specialSavings: number
    charges: number
    newMemberFee: number
    total: number
    memberType: string
  }>

  if (startPeriod <= endPeriod) {
    for (let period = startPeriod; period <= endPeriod; period = nextPeriod(period)) {
      const dataset = await buildVoucherDataset(period)
      const found = dataset.rows.find((row) => normalizeStaffId(row.staffId) === normalizedStaffId)
      if (found) {
        savingsRows.push({
          period,
          thriftSavings: found.monthlySavings,
          specialSavings: found.specialSavings,
          charges: found.monthlyCharges,
          newMemberFee: found.newMemberFee,
          total: found.totalSavings,
          memberType: found.memberType,
        })
      }
    }
  }

  const loans = await prisma.loan.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      amount: true,
      purpose: true,
      duration: true,
      interestRate: true,
      status: true,
      balance: true,
    },
  })

  const commodities = await prisma.commodityRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      itemCategory: true,
      itemModel: true,
      preferredBudget: true,
      status: true,
      adminQuotedPrice: true,
      adminApprovedMonths: true,
      adminFeedback: true,
    },
  })

  const lines: Array<(string | number)[]> = []
  lines.push(buildSavingsHeader())

  if (savingsRows.length === 0) {
    lines.push([
      'Savings',
      staffId,
      targetName,
      0,
      '',
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      '',
    ])
  } else {
    for (const row of savingsRows) {
      lines.push([
        'Savings',
        staffId,
        targetName,
        safeNumber(row.thriftSavings) + safeNumber(row.specialSavings),
        row.period,
        safeNumber(row.thriftSavings),
        safeNumber(row.specialSavings),
        0,
        0,
        0,
        safeNumber(row.charges),
        safeNumber(row.newMemberFee),
        safeNumber(row.total),
        row.memberType,
      ])
    }
  }

  lines.push([])
  lines.push(buildLoanHeader())

  if (loans.length === 0) {
    lines.push([
      'Loan',
      '-',
      staffId,
      targetName,
      0,
      'No loan records',
      0,
      LOAN_REQUEST_POLICY.adminChargePercent,
      0,
      '-',
      0,
    ])
  } else {
    for (const loan of loans) {
      const adminChargeRate = loan.interestRate || LOAN_REQUEST_POLICY.adminChargePercent
      const adminCharge = (safeNumber(loan.amount) * safeNumber(adminChargeRate)) / 100
      lines.push([
        'Loan',
        new Date(loan.createdAt).toISOString(),
        staffId,
        targetName,
        safeNumber(loan.amount),
        loan.purpose || 'N/A',
        safeNumber(loan.duration),
        safeNumber(adminChargeRate),
        safeNumber(adminCharge),
        loan.status || 'PENDING',
        safeNumber(loan.balance),
      ])
    }
  }

  lines.push([])
  lines.push(buildCommodityHeader())

  if (commodities.length === 0) {
    lines.push([
      'Commodity',
      '-',
      staffId,
      targetName,
      '-',
      0,
      'No Request',
      '-',
      '-',
      'No commodity requests yet.',
    ])
  } else {
    for (const commodity of commodities) {
      lines.push([
        'Commodity',
        new Date(commodity.createdAt).toISOString(),
        staffId,
        targetName,
        `${commodity.itemCategory}${commodity.itemModel ? ` (${commodity.itemModel})` : ''}`.trim(),
        safeNumber(commodity.preferredBudget),
        commodity.status || 'PENDING',
        commodity.adminQuotedPrice || '',
        commodity.adminApprovedMonths || '',
        commodity.adminFeedback || '',
      ])
    }
  }

  const csv = lines.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n')
  const filename = `statement-${normalizedStaffId}.csv`

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
