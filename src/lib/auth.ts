import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

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

function buildMemberEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  return `${staffId.toLowerCase()}@${domain.toLowerCase()}`
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

          let user = null as Awaited<ReturnType<typeof prisma.user.findFirst>> | null

          if (normalizedIdentifier.includes('@')) {
            user = await prisma.user.findUnique({
              where: { email: normalizedIdentifier.toLowerCase() },
            })
          } else {
            const staffId = normalizeStaffId(normalizedIdentifier)
            user = await prisma.user.findUnique({
              where: { staffId },
            })

            if (!user) {
              user = await prisma.user.findUnique({
                where: { email: buildMemberEmail(staffId) },
              })
            }
          }

          if (!user && normalizedIdentifier.includes('@')) {
            const localPart = normalizedIdentifier.split('@')[0]
            const staffId = normalizeStaffId(localPart)
            if (staffId) {
              user = await prisma.user.findUnique({
                where: { staffId },
              })
            }
          }

          if (!user || !user.password) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            password,
            user.password
          )

          if (!isPasswordValid) {
            return null
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
