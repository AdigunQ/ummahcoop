import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { notifyAdminsOfNewMember } from '@/lib/notifications'
import { z } from 'zod'
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit'

const amountSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return undefined
    if (typeof value === 'string') return Number(value.replace(/,/g, ''))
    return value
  },
  z.number().finite().positive().max(1_000_000_000).optional()
)

const registerPayloadSchema = z.object({
  name: z.string().trim().min(1),
  staffId: z.string().trim().min(1).regex(/^[a-zA-Z0-9-]+$/),
  phone: z.string().trim().optional(),
  savingsPlan: z.enum(['THRIFT', 'SPECIAL', 'BOTH']),
  thriftAmount: amountSchema,
  specialAmount: amountSchema,
  department: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  bankAccountName: z.string().trim().optional(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).superRefine((data, context) => {
  const usesThrift = data.savingsPlan === 'THRIFT' || data.savingsPlan === 'BOTH'
  const usesSpecial = data.savingsPlan === 'SPECIAL' || data.savingsPlan === 'BOTH'

  if (usesThrift && !data.thriftAmount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['thriftAmount'], message: 'Monthly thrift amount is required' })
  }
  if (usesSpecial && !data.specialAmount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['specialAmount'], message: 'Monthly special amount is required' })
  }
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match' })
  }
})

function buildMemberEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  return `${staffId.toLowerCase()}@${domain.toLowerCase()}`
}

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req)
    const rateLimit = checkRateLimit({
      key: `register:${ip}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const parsed = registerPayloadSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid registration details. Please check all required fields.' },
        { status: 400 }
      )
    }

    const {
      name,
      staffId,
      phone,
      savingsPlan,
      thriftAmount,
      specialAmount,
      department,
      bankName,
      bankAccountNumber,
      bankAccountName,
      password,
      confirmPassword,
    } = parsed.data

    const normalizedStaffId = staffId.trim().toUpperCase()
    const normalizedEmail = buildMemberEmail(normalizedStaffId)
    const normalizedDepartment = department?.trim() || 'N/A'
    const normalizedBankName = bankName?.trim() || null
    const normalizedBankAccountNumber = bankAccountNumber?.trim() || null
    const normalizedBankAccountName = bankAccountName?.trim() || null
    const passwordValue = password

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Staff ID already registered' },
        { status: 400 }
      )
    }

    const existingStaffId = await prisma.user.findUnique({
      where: { staffId: normalizedStaffId },
    })

    if (existingStaffId) {
      return NextResponse.json(
        { error: 'Staff ID already registered' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(passwordValue, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        staffId: normalizedStaffId,
        phone: phone?.trim() || null,
        department: normalizedDepartment,
        savingsPlan,
        bankName: normalizedBankName,
        bankAccountNumber: normalizedBankAccountNumber,
        bankAccountName: normalizedBankAccountName,
        monthlyContribution: savingsPlan === 'SPECIAL' ? 0 : thriftAmount || 0,
        specialContribution: savingsPlan === 'THRIFT' ? 0 : specialAmount || 0,
        password: hashedPassword,
        role: 'MEMBER',
        status: 'PENDING',
        balance: 0,
        totalContributions: 0,
        loanBalance: 0,
      },
    })

    try {
      await notifyAdminsOfNewMember({
        name,
        staffId: normalizedStaffId,
        savingsPlan,
        thriftAmount: savingsPlan === 'SPECIAL' ? 0 : thriftAmount || 0,
        specialAmount: savingsPlan === 'THRIFT' ? 0 : specialAmount || 0,
        submittedAt: new Date(),
      })
    } catch (notificationError) {
      // A provider outage must not turn a successful registration into an error.
      console.error('Unable to notify admins about new member registration', notificationError)
    }

    return NextResponse.json(
      { 
        message: 'Registration successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          staffId: user.staffId,
          status: user.status,
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
