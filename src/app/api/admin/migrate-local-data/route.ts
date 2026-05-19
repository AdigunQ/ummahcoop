import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type ImportedRow = Record<string, unknown>

type ImportedPayload = {
  users: ImportedRow[]
  memberDataMonths: ImportedRow[]
  vouchers: ImportedRow[]
}

const DELETE_ORDER = [
  'transaction',
  'repayment',
  'payment',
  'loan',
  'withdrawal',
  'voucher',
  'commodityRequest',
  'payrollLine',
  'payrollCycle',
  'memberDataMonth',
  'account',
  'session',
  'verificationToken',
  'user',
] as const

function requireAdminSecret(req: Request) {
  const secret = process.env.ADMIN_MAINTENANCE_SECRET?.trim()
  if (!secret) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Maintenance endpoint disabled' }, { status: 503 }) }
  }

  const requestSecret = req.headers.get('x-admin-secret')?.trim()
  if (!requestSecret || requestSecret !== secret) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  return { ok: true as const }
}

function reviveDates(row: ImportedRow, dateKeys: Set<string>): ImportedRow {
  const revived: ImportedRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue

    if (value === null) {
      revived[key] = null
      continue
    }

    if (typeof value === 'string' && dateKeys.has(key)) {
      const parsed = new Date(value)
      revived[key] = Number.isNaN(parsed.valueOf()) ? value : parsed
      continue
    }

    revived[key] = value
  }
  return revived
}

function normalizePayload(body: any): ImportedPayload {
  const source = body?.sourceData ?? body?.data ?? body
  if (!source || !Array.isArray(source.users) || !Array.isArray(source.memberDataMonths) || !Array.isArray(source.vouchers)) {
    throw new Error('Invalid payload. Expected users, memberDataMonths, and vouchers arrays.')
  }
  return source
}

export async function POST(req: Request) {
  const adminCheck = requireAdminSecret(req)
  if (!adminCheck.ok) return adminCheck.response

  try {
    const body = await req.json()
    const payload = normalizePayload(body)

    const users = payload.users.map((row) =>
      reviveDates(row, new Set(['emailVerified', 'closureDate', 'createdAt', 'updatedAt']))
    )
    const memberDataMonths = payload.memberDataMonths.map((row) =>
      reviveDates(row, new Set(['uploadedAt', 'createdAt', 'updatedAt']))
    )
    const vouchers = payload.vouchers.map((row) =>
      reviveDates(row, new Set(['effectiveStartDate', 'generatedAt', 'sentAt']))
    )

    const result = await prisma.$transaction(async (tx) => {
      for (const model of DELETE_ORDER) {
        await (tx as any)[model].deleteMany()
      }

      if (users.length) {
        await tx.user.createMany({ data: users as any[] })
      }

      if (memberDataMonths.length) {
        await tx.memberDataMonth.createMany({ data: memberDataMonths as any[] })
      }

      if (vouchers.length) {
        await tx.voucher.createMany({ data: vouchers as any[] })
      }

      return {
        users: await tx.user.count(),
        memberDataMonths: await tx.memberDataMonth.count(),
        vouchers: await tx.voucher.count(),
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Live database replaced with local data',
      counts: result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Migration failed' },
      { status: 500 }
    )
  }
}
