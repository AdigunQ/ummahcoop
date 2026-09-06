import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import TransactionsClient from './TransactionsClient'

export default async function HistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'MEMBER') redirect('/dashboard')
  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      _count: { select: { payments: true, transactions: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          type: true,
          amount: true,
          date: true,
          transactionReference: true,
          status: true,
          notes: true,
          reviewedAt: true,
          createdAt: true,
        },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          reference: true,
          description: true,
          createdAt: true,
        },
      },
    },
  })
  if (!member) redirect('/login')
  return (
    <TransactionsClient
      ledger={member.transactions.map((record) => ({
        ...record,
        date: record.createdAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
        reviewedAt: null,
      }))}
      payments={member.payments.map((record) => ({
        id: record.id,
        type: record.type,
        amount: record.amount,
        status: record.status,
        reference: record.transactionReference,
        description: record.notes,
        date: record.date.toISOString(),
        createdAt: record.createdAt.toISOString(),
        reviewedAt: record.reviewedAt?.toISOString() ?? null,
      }))}
      counts={{ ledger: member._count.transactions, payments: member._count.payments }}
    />
  )
}
