import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function requireAdminSecret(req: Request) {
  const configuredSecret = process.env.ADMIN_MAINTENANCE_SECRET?.trim()
  const requestSecret = req.headers.get('x-admin-secret')?.trim()

  return Boolean(configuredSecret && requestSecret && requestSecret === configuredSecret)
}

function isGeneratedMemberEmail(email: string, staffId: string | null) {
  if (!staffId) return false
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedStaffId = staffId.trim().replace(/\s+/g, '').toLowerCase()

  return (
    normalizedEmail === `${normalizedStaffId}@faan-ummah.coop` ||
    normalizedEmail === `${normalizedStaffId}@ummahcoop.org` ||
    normalizedEmail.startsWith(`member-${normalizedStaffId}@`)
  )
}

function internalEmail(staffId: string) {
  const normalizedStaffId = staffId.trim().replace(/\s+/g, '').toLowerCase()
  return `member-${normalizedStaffId}@internal.ummahcoop`
}

export async function POST(req: Request) {
  if (!requireAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dryRun') === '1'

  const members = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      staffId: { not: null },
    },
    select: {
      id: true,
      staffId: true,
      email: true,
      name: true,
    },
    orderBy: { staffId: 'asc' },
  })

  const targets = members.filter((member) => isGeneratedMemberEmail(member.email, member.staffId))

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      membersFound: members.length,
      placeholdersFound: targets.length,
      sample: targets.slice(0, 8).map((member) => ({
        staffId: member.staffId,
        name: member.name,
        currentEmail: member.email,
        nextEmail: member.staffId ? internalEmail(member.staffId) : member.email,
      })),
    })
  }

  let updated = 0

  for (const member of targets) {
    if (!member.staffId) continue

    await prisma.user.update({
      where: { id: member.id },
      data: { email: internalEmail(member.staffId) },
    })

    updated += 1
  }

  return NextResponse.json({
    ok: true,
    updated,
    message: 'Generated member emails moved to internal placeholders.',
  })
}
