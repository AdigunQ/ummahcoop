import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { buildVoucherDataset, resolveVoucherPeriod } from '@/lib/vouchers'
import { getCurrentMemberReportDataset } from '@/lib/current-member-data'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '')
  const escapedForSpreadsheet = /^[=+\-@ \t\r]/.test(raw) ? `'${raw}` : raw
  if (/[",\n]/.test(escapedForSpreadsheet)) {
    return `"${escapedForSpreadsheet.replace(/"/g, '""')}"`
  }
  return escapedForSpreadsheet
}

type ExportRow = {
  staffId: string
  name: string
  monthlySavings: number
  specialSavings: number
  monthlyFee: number
  formFee: number
}

function buildAbanoRows(rows: ExportRow[], periodLabel: string): string {
  const lines: Array<Array<string | number>> = [
    [
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
    ],
    ...rows.map((row) => {
      const amount = row.monthlySavings + row.specialSavings
      const total = amount + row.monthlyFee + row.formFee
      return [
        row.staffId,
        row.name,
        amount,
        periodLabel,
        row.monthlySavings,
        row.specialSavings,
        0,
        0,
        0,
        row.monthlyFee,
        row.formFee,
        total,
      ]
    }),
  ]

  return lines.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n')
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.VIEW_FINANCE))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const periodInput = searchParams.get('period') || undefined
  const resolved = resolveVoucherPeriod(periodInput)
  const currentPeriod = resolveVoucherPeriod().period
  const dataset = resolved.period >= currentPeriod
    ? await getCurrentMemberReportDataset(resolved.period)
    : await buildVoucherDataset(resolved.period)

  const rows: ExportRow[] = dataset.rows.map((row) => ({
    staffId: row.staffId,
    name: row.name,
    monthlySavings: row.monthlySavings,
    specialSavings: row.specialSavings,
    monthlyFee: row.monthlyCharges,
    formFee: row.newMemberFee,
  }))

  const periodLabel = resolved.period
  const csv = buildAbanoRows(rows, periodLabel)
  const filename = `monthly-deduction-${dataset.period}.csv`

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
