import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function requireAdminSecret(req: Request) {
  const configuredSecret = process.env.ADMIN_MAINTENANCE_SECRET?.trim()
  const requestSecret = req.headers.get('x-admin-secret')?.trim()

  return Boolean(configuredSecret && requestSecret && requestSecret === configuredSecret)
}

function compactStaffId(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
}

function readSnapshotValue(row: unknown, keys: string[]): string {
  if (!row || typeof row !== 'object') return ''
  const record = row as Record<string, unknown>

  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim()
    }
  }

  return ''
}

export async function GET(req: Request) {
  if (!requireAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const staffId = compactStaffId(searchParams.get('staffId'))
  if (!staffId) {
    return NextResponse.json({ ok: false, error: 'staffId is required' }, { status: 400 })
  }

  const exactUser = await prisma.user.findUnique({
    where: { staffId },
    select: {
      id: true,
      staffId: true,
      email: true,
      name: true,
      role: true,
      status: true,
      password: true,
    },
  })

  const looseUsers = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      staffId: { not: null },
    },
    select: {
      id: true,
      staffId: true,
      email: true,
      name: true,
      role: true,
      status: true,
      password: true,
    },
  })

  const looseUser = looseUsers.find((user) => compactStaffId(user.staffId) === staffId) || null
  const user = exactUser || looseUser

  const months = await prisma.memberDataMonth.findMany({
    orderBy: { period: 'desc' },
    take: 6,
    select: {
      period: true,
      label: true,
      rowCount: true,
      rows: true,
    },
  })

  const snapshotMatches = months.flatMap((month) => {
    const rows = Array.isArray(month.rows) ? month.rows : []
    return rows
      .filter((row) => compactStaffId(readSnapshotValue(row, ['Staff ID', 'staffId', 'StaffID', 'STAFF ID'])) === staffId)
      .map((row) => ({
        period: month.period,
        label: month.label,
        staffId: readSnapshotValue(row, ['Staff ID', 'staffId', 'StaffID', 'STAFF ID']),
        name: readSnapshotValue(row, ['Name', 'name']),
      }))
  })

  const passwordEqualsStaffId = user?.password
    ? await bcrypt.compare(staffId, user.password)
    : false

  return NextResponse.json({
    ok: true,
    staffId,
    user: user
      ? {
          id: user.id,
          staffId: user.staffId,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          hasPassword: Boolean(user.password),
          passwordEqualsStaffId,
        }
      : null,
    exactUserFound: Boolean(exactUser),
    looseUserFound: Boolean(looseUser),
    snapshotMatches,
  })
}
