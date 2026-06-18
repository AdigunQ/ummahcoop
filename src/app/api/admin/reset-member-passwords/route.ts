import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getInitialMemberPassword } from '@/lib/default-member-password'

export const runtime = 'nodejs'

function requireAdminSecret(req: Request) {
  const configuredSecret = process.env.ADMIN_MAINTENANCE_SECRET?.trim()
  const requestSecret = req.headers.get('x-admin-secret')?.trim()

  if (!configuredSecret || !requestSecret || requestSecret !== configuredSecret) {
    return false
  }

  return true
}

export async function POST(req: Request) {
  if (!requireAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const staffIdInput = searchParams.get('staffId')?.trim()
  const normalizedStaffId = staffIdInput?.replace(/\s+/g, '').toUpperCase()

  if (normalizedStaffId) {
    const member = await prisma.user.findFirst({
      where: {
        role: 'MEMBER',
        staffId: {
          equals: normalizedStaffId,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        staffId: true,
        name: true,
        status: true,
        password: true,
      },
    })

    if (!member?.staffId) {
      return NextResponse.json({
        ok: false,
        error: `No member user found for Staff ID ${normalizedStaffId}.`,
      }, { status: 404 })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        member: {
          staffId: member.staffId,
          name: member.name,
          status: member.status,
          hasPassword: Boolean(member.password),
        },
      })
    }

    const passwordHash = await bcrypt.hash(getInitialMemberPassword(member.staffId), 10)
    await prisma.user.update({
      where: { id: member.id },
      data: {
        password: passwordHash,
        status: member.status === 'PENDING' ? 'ACTIVE' : member.status,
      },
    })

    return NextResponse.json({
      ok: true,
      updated: 1,
      staffId: member.staffId,
      message: 'Member password reset to Staff ID.',
    })
  }

  const members = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      staffId: { not: null },
    },
    select: {
      id: true,
      staffId: true,
      name: true,
    },
    orderBy: { staffId: 'asc' },
  })

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      membersFound: members.length,
      sample: members.slice(0, 5).map((member) => ({
        staffId: member.staffId,
        name: member.name,
      })),
    })
  }

  let updated = 0

  for (const member of members) {
    if (!member.staffId) continue

    const password = getInitialMemberPassword(member.staffId)
    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: member.id },
      data: { password: passwordHash },
    })

    updated += 1
  }

  return NextResponse.json({
    ok: true,
    updated,
    message: 'Member passwords reset to Staff ID.',
  })
}
