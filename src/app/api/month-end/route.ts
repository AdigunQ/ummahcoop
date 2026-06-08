import { NextResponse } from 'next/server'
import { autoPostMonthEndIfDue } from '@/lib/payroll'

export async function POST(req: Request) {
  const secret = process.env.MONTH_END_CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Maintenance endpoint disabled' }, { status: 503 })
  }

  const provided = req.headers.get('x-cron-secret') || ''
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await autoPostMonthEndIfDue(new Date())
  return NextResponse.json({
    ok: true,
    ...result,
    runAt: new Date().toISOString(),
  })
}
