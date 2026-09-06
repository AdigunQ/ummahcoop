import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMemberFinanceSummary } from '@/lib/member-finance'
import MyLoansClient from './MyLoansClient'

export default async function MyLoansPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'MEMBER') redirect('/dashboard')
  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      staffId: true,
      loans: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          purpose: true,
          duration: true,
          interestRate: true,
          monthlyPayment: true,
          totalRepayable: true,
          balance: true,
          status: true,
          approvedAt: true,
          createdAt: true,
          disbursementBankName: true,
          disbursementAccountNumber: true,
          disbursementAccountName: true,
          repayments: { orderBy: { date: 'desc' }, select: { id: true, amount: true, date: true } },
        },
      },
    },
  })
  if (!member) redirect('/login')
  const finance = await getMemberFinanceSummary(session.user.id, member.staffId)
  return (
    <MyLoansClient
      loans={member.loans.map((loan) => ({
        ...loan,
        createdAt: loan.createdAt.toISOString(),
        approvedAt: loan.approvedAt?.toISOString() ?? null,
        repayments: loan.repayments.map((payment) => ({
          ...payment,
          date: payment.date.toISOString(),
        })),
      }))}
      totals={{
        collected: finance.loanCollected,
        paid: finance.loanPaid,
        outstanding: finance.loanOutstanding,
        period: finance.ledgerPeriod,
      }}
    />
  )
}
