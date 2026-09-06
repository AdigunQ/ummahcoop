import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { notifyAdminsOfNewMember } from '@/lib/notifications'
import { registerPayloadSchema } from '@/lib/registration'
import { Prisma } from '@prisma/client'
import { checkRateLimit, getRequestIp } from '@/lib/rate-limit'

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
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Staff ID already registered' }, { status: 409 })
    }
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
