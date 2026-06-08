import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit'
import { getDefaultMemberPassword } from '@/lib/default-member-password'

const integrationPayloadSchema = z.object({
  fullName: z.string().trim().min(1),
  staffId: z.string().trim().min(1).regex(/^[a-zA-Z0-9-]+$/),
  department: z.string().trim().min(1),
  monthlySavings: z.coerce.number().gt(0),
  phoneNumber: z.string().trim().min(1),
  submissionId: z.string().trim().optional(),
  submittedAt: z.string().trim().optional(),
})

const fieldAliases = {
  fullName: ['fullName', 'name', 'Full Name', 'full_name'],
  staffId: ['staffId', 'staffID', 'Staff ID', 'staff_id', 'Employee No.', 'employeeNo'],
  department: ['department', 'Department'],
  monthlySavings: ['monthlySavings', 'monthlyContribution', 'Monthly Savings Amount', 'Amount', 'Thrift Savings'],
  phoneNumber: ['phoneNumber', 'phone', 'Phone Number', 'Phone'],
  submissionId: ['submissionId', 'responseId', 'Response ID'],
  submittedAt: ['submittedAt', 'timestamp', 'Timestamp'],
} as const

function pickField(source: Record<string, unknown>, aliases: readonly string[]) {
  for (const key of aliases) {
    const value = source[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }
  return undefined
}

function normalizeIncomingPayload(raw: Record<string, unknown>) {
  return {
    fullName: pickField(raw, fieldAliases.fullName),
    staffId: pickField(raw, fieldAliases.staffId),
    department: pickField(raw, fieldAliases.department),
    monthlySavings: pickField(raw, fieldAliases.monthlySavings),
    phoneNumber: pickField(raw, fieldAliases.phoneNumber),
    submissionId: pickField(raw, fieldAliases.submissionId),
    submittedAt: pickField(raw, fieldAliases.submittedAt),
  }
}

function normalizeStaffId(staffId: string): string {
  return staffId.trim().replace(/\s+/g, '').toUpperCase()
}

function buildMemberEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  return `${staffId.toLowerCase()}@${domain.toLowerCase()}`
}

function isAuthorized(req: Request): boolean {
  const expectedSecret = process.env.GOOGLE_FORM_WEBHOOK_SECRET?.trim()
  if (!expectedSecret) return false

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim()
  const customHeader = req.headers.get('x-webhook-secret')?.trim()

  return (
    bearerToken === expectedSecret ||
    customHeader === expectedSecret
  )
}

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req)
    const rateLimit = checkRateLimit({
      key: `google-form:${ip}`,
      limit: 120,
      windowMs: 60 * 1000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    if (!process.env.GOOGLE_FORM_WEBHOOK_SECRET?.trim()) {
      return NextResponse.json(
        { error: 'GOOGLE_FORM_WEBHOOK_SECRET is not configured on server.' },
        { status: 503 }
      )
    }

    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized webhook request.' }, { status: 401 })
    }

    const rawBody = await req.json().catch(() => null)
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
    }

    const payloadSource =
      rawBody && typeof (rawBody as Record<string, unknown>).data === 'object'
        ? ((rawBody as Record<string, unknown>).data as Record<string, unknown>)
        : (rawBody as Record<string, unknown>)

    const parsed = integrationPayloadSchema.safeParse(normalizeIncomingPayload(payloadSource))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload. Required: fullName, staffId, department, monthlySavings (>0), phoneNumber.' },
        { status: 400 }
      )
    }

    const normalizedStaffId = normalizeStaffId(parsed.data.staffId)
    const generatedEmail = buildMemberEmail(normalizedStaffId)

    const existingByStaffId = await prisma.user.findUnique({
      where: { staffId: normalizedStaffId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })

    if (existingByStaffId) {
      if (existingByStaffId.role !== 'MEMBER') {
        return NextResponse.json(
          { error: `Staff ID ${normalizedStaffId} already belongs to a non-member account.` },
          { status: 409 }
        )
      }

      if (existingByStaffId.status === 'ACTIVE') {
        return NextResponse.json(
          {
            ok: true,
            result: 'already_active',
            userId: existingByStaffId.id,
            staffId: normalizedStaffId,
          },
          { status: 200 }
        )
      }

      const updated = await prisma.user.update({
        where: { id: existingByStaffId.id },
        data: {
          name: parsed.data.fullName,
          phone: parsed.data.phoneNumber,
          department: parsed.data.department,
          monthlyContribution: parsed.data.monthlySavings,
          status: 'PENDING',
          voucherEnabled: true,
        },
        select: { id: true, staffId: true, status: true },
      })

      return NextResponse.json(
        {
          ok: true,
          result: 'updated_pending',
          userId: updated.id,
          staffId: updated.staffId,
          status: updated.status,
        },
        { status: 200 }
      )
    }

    const existingByEmail = await prisma.user.findUnique({
      where: { email: generatedEmail },
      select: { id: true },
    })

    if (existingByEmail) {
      return NextResponse.json(
        { error: `Generated email for ${normalizedStaffId} conflicts with an existing account.` },
        { status: 409 }
      )
    }

    let defaultPassword: string
    try {
      defaultPassword = getDefaultMemberPassword()
    } catch {
      return NextResponse.json(
        { error: 'Webhook processing is temporarily unavailable.' },
        { status: 503 }
      )
    }
    const passwordHash = await bcrypt.hash(defaultPassword, 10)

    const now = new Date()
    const effectiveStartDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.fullName,
          email: generatedEmail,
          staffId: normalizedStaffId,
          phone: parsed.data.phoneNumber,
          department: parsed.data.department,
          password: passwordHash,
          role: 'MEMBER',
          status: 'PENDING',
          monthlyContribution: parsed.data.monthlySavings,
          specialContribution: 0,
          balance: 0,
          specialBalance: 0,
          totalContributions: 0,
          loanBalance: 0,
          voucherEnabled: true,
        },
      })

      await tx.voucher.create({
        data: {
          userId: user.id,
          fullName: user.name || 'Unnamed Member',
          staffId: normalizedStaffId,
          department: parsed.data.department,
          monthlyDeduction: parsed.data.monthlySavings,
          effectiveStartDate,
          status: 'GENERATED',
          notes: 'Auto-created from Google Form submission. Awaiting admin approval.',
        },
      })

      return user
    })

    return NextResponse.json(
      {
        ok: true,
        result: 'created_pending',
        userId: createdUser.id,
        staffId: createdUser.staffId,
        status: createdUser.status,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Google form integration error:', error)
    return NextResponse.json({ error: 'Integration request failed.' }, { status: 500 })
  }
}
