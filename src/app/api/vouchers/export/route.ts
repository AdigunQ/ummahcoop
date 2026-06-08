import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { buildVoucherDataset, resolveVoucherPeriod } from '@/lib/vouchers'
import { getCurrentMemberReportDataset } from '@/lib/current-member-data'

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '')
  const escapedForSpreadsheet = /^[=+\-@ \t\r]/.test(raw) ? `'${raw}` : raw
  if (/[",\n]/.test(escapedForSpreadsheet)) {
    return `"${escapedForSpreadsheet.replace(/"/g, '""')}"`
  }
  return escapedForSpreadsheet
}

function buildThreeColumnCsv(rows: Array<{ staffId: string; name: string; monthlyDeduction: number }>): string {
  const lines: Array<Array<string | number>> = [
    ['Staff ID', 'Name', 'Monthly Deduction'],
    ...rows.map((row) => [row.staffId, row.name, row.monthlyDeduction]),
  ]

  return lines.map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n')
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const periodInput = searchParams.get('period') || undefined
  const resolved = resolveVoucherPeriod(periodInput)
  const currentPeriod = resolveVoucherPeriod().period
  const dataset = resolved.period >= currentPeriod
    ? await getCurrentMemberReportDataset(resolved.period)
    : await buildVoucherDataset(resolved.period)
  const csv = buildThreeColumnCsv(
    dataset.rows.map((row) => ({
      staffId: row.staffId,
      name: row.name,
      monthlyDeduction: row.totalSavings,
    }))
  )
  const filename = `monthly-deduction-${dataset.period}.csv`

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
