import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit'

const registerPayloadSchema = z.object({
  name: z.string().trim().min(1),
  staffId: z.string().trim().min(1).regex(/^[a-zA-Z0-9-]+$/),
  phone: z.string().trim().min(1),
  department: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  bankAccountName: z.string().trim().optional(),
  password: z.string().min(6).optional(),
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
      department,
      bankName,
      bankAccountNumber,
      bankAccountName,
      password,
    } = parsed.data

    const normalizedStaffId = staffId.trim().toUpperCase()
    const normalizedEmail = buildMemberEmail(normalizedStaffId)
    const normalizedDepartment = department?.trim() || 'N/A'
    const normalizedBankName = bankName?.trim() || null
    const normalizedBankAccountNumber = bankAccountNumber?.trim() || null
    const normalizedBankAccountName = bankAccountName?.trim() || null
    const passwordValue = (password || normalizedStaffId).trim()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
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
        phone,
        department: normalizedDepartment,
        bankName: normalizedBankName,
        bankAccountNumber: normalizedBankAccountNumber,
        bankAccountName: normalizedBankAccountName,
        monthlyContribution: 0,
        specialContribution: 0,
        password: hashedPassword,
        role: 'MEMBER',
        status: 'PENDING',
        balance: 0,
        totalContributions: 0,
        loanBalance: 0,
      },
    })

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
