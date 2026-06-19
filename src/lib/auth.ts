import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { getInitialMemberPassword } from './default-member-password'

type AuthUser = {
  id: string
  email: string
  name: string | null
  staffId: string | null
  password: string | null
  role: string
  status: string
  image: string | null
}

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  staffId: true,
  password: true,
  role: true,
  status: true,
  image: true,
} as const

function normalizeAuthErrorMessage(error: unknown): string {
  const allowedMessages = new Set([
    'Account pending approval. Please wait for admin verification.',
    'Account has been rejected. Contact admin for assistance.',
    'Account has been suspended. Contact admin.',
    'Account is closed. Contact admin for reactivation.',
    'Unable to sign in right now. Please try again.',
  ])

  const message = error instanceof Error ? error.message.trim() : typeof error === 'string' ? error.trim() : ''
  if (message && allowedMessages.has(message)) {
    return message
  }

  return 'Unable to sign in right now. Please try again.'
}

function normalizeStaffId(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function compactStaffId(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
}

function buildMemberEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  return `${staffId.toLowerCase()}@${domain.toLowerCase()}`
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

async function findLatestSnapshotMember(staffId: string) {
  const compactLoginStaffId = compactStaffId(staffId)
  if (!compactLoginStaffId) return null

  const months = await prisma.memberDataMonth.findMany({
    orderBy: { period: 'desc' },
    select: {
      period: true,
      rows: true,
    },
    take: 3,
  })

  for (const month of months) {
    const rows = Array.isArray(month.rows) ? month.rows : []
    for (const row of rows) {
      const rowStaffId = readSnapshotValue(row, ['Staff ID', 'staffId', 'StaffID', 'STAFF ID'])
      if (compactStaffId(rowStaffId) !== compactLoginStaffId) continue

      return {
        staffId: rowStaffId,
        name: readSnapshotValue(row, ['Name', 'name']) || rowStaffId,
        department: readSnapshotValue(row, ['Department', 'department']) || null,
        thriftSavings: Number(readSnapshotValue(row, ['Thrift Savings', 'thriftSavings']) || 0) || 0,
        specialSavings: Number(readSnapshotValue(row, ['Special Savings', 'Special Saving', 'specialSavings']) || 0) || 0,
      }
    }
  }

  return null
}

async function createMemberUserFromSnapshot(staffId: string): Promise<AuthUser | null> {
  const snapshotMember = await findLatestSnapshotMember(staffId)
  if (!snapshotMember) return null

  const normalizedStaffId = normalizeStaffId(snapshotMember.staffId || staffId)
  const email = buildMemberEmail(normalizedStaffId)
  const passwordHash = await bcrypt.hash(getInitialMemberPassword(normalizedStaffId), 10)

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: AUTH_USER_SELECT,
  })

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        staffId: existingByEmail.staffId || normalizedStaffId,
        name: existingByEmail.name || snapshotMember.name,
        password: existingByEmail.password || passwordHash,
        status: existingByEmail.status === 'PENDING' ? 'ACTIVE' : existingByEmail.status,
        role: 'MEMBER',
        voucherEnabled: true,
      },
    })
  }

  return prisma.user.create({
    data: {
      staffId: normalizedStaffId,
      email,
      name: snapshotMember.name,
      department: snapshotMember.department,
      password: passwordHash,
      role: 'MEMBER',
      status: 'ACTIVE',
      monthlyContribution: snapshotMember.thriftSavings,
      specialContribution: snapshotMember.specialSavings,
      balance: 0,
      specialBalance: 0,
      totalContributions: 0,
      loanBalance: 0,
      voucherEnabled: true,
    },
  })
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Staff ID or Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.identifier || !credentials?.password) {
            return null
          }

          const identifier = credentials.identifier.trim()
          const normalizedIdentifier = identifier.replace(/\s+/g, '')
          const password = credentials.password

          let user = null as AuthUser | null

          if (normalizedIdentifier.includes('@')) {
            user = await prisma.user.findUnique({
              where: { email: normalizedIdentifier.toLowerCase() },
              select: AUTH_USER_SELECT,
            })
          } else {
            const staffId = normalizeStaffId(normalizedIdentifier)
            user = await prisma.user.findUnique({
              where: { staffId },
              select: AUTH_USER_SELECT,
            })

            if (!user) {
              user = await prisma.user.findFirst({
                where: {
                  staffId: {
                    equals: staffId,
                    mode: 'insensitive',
                  },
                },
                select: AUTH_USER_SELECT,
              })
            }

            if (!user) {
              user = await prisma.user.findUnique({
                where: { email: buildMemberEmail(staffId) },
                select: AUTH_USER_SELECT,
              })
            }

            if (!user) {
              const compactLoginStaffId = compactStaffId(staffId)
              const possibleMembers = await prisma.user.findMany({
                where: {
                  role: 'MEMBER',
                  staffId: { not: null },
                },
                select: AUTH_USER_SELECT,
              })

              user = possibleMembers.find((member) => compactStaffId(member.staffId) === compactLoginStaffId) || null
            }

            if (!user) {
              user = await createMemberUserFromSnapshot(staffId)
            }
          }

          if (!user && normalizedIdentifier.includes('@')) {
            const localPart = normalizedIdentifier.split('@')[0]
            const staffId = normalizeStaffId(localPart)
            if (staffId) {
              user = await prisma.user.findUnique({
                where: { staffId },
                select: AUTH_USER_SELECT,
              })
            }
          }

          if (!user) {
            return null
          }

          const isStaffIdFallbackPassword =
            user.role === 'MEMBER' &&
            Boolean(user.staffId) &&
            compactStaffId(password) === compactStaffId(user.staffId)
          const isPasswordValid = user.password
            ? await bcrypt.compare(password, user.password)
            : false

          if (!isPasswordValid && !isStaffIdFallbackPassword) {
            return null
          }

          if ((!user.password || !isPasswordValid) && isStaffIdFallbackPassword) {
            await prisma.user.update({
              where: { id: user.id },
              data: { password: await bcrypt.hash(compactStaffId(user.staffId), 10) },
            })
          }

          if (user.status === 'PENDING') {
            throw new Error('Account pending approval. Please wait for admin verification.')
          }

          if (user.status === 'REJECTED') {
            throw new Error('Account has been rejected. Contact admin for assistance.')
          }

          if (user.status === 'SUSPENDED') {
            throw new Error('Account has been suspended. Contact admin.')
          }

          if (user.status === 'CLOSED') {
            throw new Error('Account is closed. Contact admin for reactivation.')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            image: user.image,
          }
        } catch (error) {
          throw new Error(normalizeAuthErrorMessage(error))
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.status = user.status
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.status = token.status as string
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`User ${user.email} signed in`)
      }
    },
  },
}
