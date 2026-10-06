import { PayrollLineType, PayrollLineStatus, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateReference } from '@/lib/utils'
import { resolveContributionPlans } from '@/lib/contribution-plans'
import { lockContributionPeriod } from '@/lib/contribution-period-lock'

type DraftLine = {
  cycleId: string
  userId: string
  loanId?: string
  lineType: PayrollLineType
  expectedAmount: number
  actualAmount: number
  reason?: string
}

export function getPeriodForDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

export function getMonthRange(period: string) {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start, end }
}

async function buildDraftLines(cycleId: string, period: string, db: Prisma.TransactionClient): Promise<DraftLine[]> {
  const { start, end } = getMonthRange(period)

  const [storedSavers, activeLoans, directRepayments] = await Promise.all([
    db.user.findMany({
      where: {
        role: 'MEMBER',
        status: 'ACTIVE',
        voucherEnabled: true,
      },
      select: { id: true, monthlyContribution: true },
    }),
    db.loan.findMany({
      where: { status: 'APPROVED', balance: { gt: 0 } },
      select: { id: true, userId: true, monthlyPayment: true, balance: true },
    }),
    db.payment.findMany({
      where: {
        type: 'LOAN_REPAYMENT',
        status: 'APPROVED',
        date: { gte: start, lt: end },
      },
      select: { userId: true, amount: true },
    }),
  ])
  const savers = await resolveContributionPlans(storedSavers, period, db)

  const directByUser = new Map<string, number>()
  for (const row of directRepayments) {
    directByUser.set(row.userId, (directByUser.get(row.userId) || 0) + row.amount)
  }

  const lines: DraftLine[] = []

  for (const saver of savers) {
    const amount = saver.monthlyContribution || 0
    if (amount <= 0) continue
    lines.push({
      cycleId,
      userId: saver.id,
      lineType: 'SAVINGS',
      expectedAmount: amount,
      actualAmount: amount,
    })
  }

  for (const loan of activeLoans) {
    const scheduled = Math.min(loan.monthlyPayment || 0, loan.balance)
    const directPaid = directByUser.get(loan.userId) || 0
    const due = Math.max(0, scheduled - directPaid)
    if (due <= 0) continue

    lines.push({
      cycleId,
      userId: loan.userId,
      loanId: loan.id,
      lineType: 'LOAN_REPAYMENT',
      expectedAmount: due,
      actualAmount: due,
      reason: directPaid > 0 ? `Adjusted for direct repayment (${directPaid}).` : undefined,
    })
  }

  return lines
}

export async function ensureCycleDraft(period: string) {
  return prisma.$transaction(async tx => {
    await lockContributionPeriod(tx, period)
    const cycle = await tx.payrollCycle.upsert({
      where: { period },
      update: {},
      create: { period, status: 'DRAFT' },
    })

    const existingLineCount = await tx.payrollLine.count({ where: { cycleId: cycle.id } })
    if (cycle.status === 'DRAFT' && existingLineCount === 0) {
      const lines = await buildDraftLines(cycle.id, period, tx)
      if (lines.length > 0) {
        await tx.payrollLine.createMany({ data: lines })
      }
    }

    return tx.payrollCycle.findUnique({
      where: { id: cycle.id },
      include: {
        lines: {
          where: { status: { in: ['PENDING', 'EXCLUDED'] } },
          include: { loan: true },
        },
      },
    })
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
}

export async function postFinanceConfirmedCycle(cycleId: string, actor: string) {
  const cycle = await prisma.payrollCycle.findUnique({
    where: { id: cycleId },
    include: {
      lines: {
        where: { status: 'PENDING' },
        include: { loan: true },
      },
    },
  })

  if (!cycle || cycle.status !== 'FINANCE_CONFIRMED') return false

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    for (const line of cycle.lines) {
      const amount = Math.max(0, line.actualAmount ?? line.expectedAmount)
      if (amount <= 0) {
        await tx.payrollLine.update({
          where: { id: line.id },
          data: { status: 'EXCLUDED' },
        })
        continue
      }

      if (line.lineType === 'SAVINGS') {
        await tx.user.update({
          where: { id: line.userId },
          data: {
            balance: { increment: amount },
            totalContributions: { increment: amount },
          },
        })

        await tx.transaction.create({
          data: {
            userId: line.userId,
            type: 'CONTRIBUTION',
            amount,
            status: 'COMPLETED',
            reference: generateReference(),
            description: `Monthly savings payroll posting (${cycle.period}).`,
          },
        })
      } else if (line.lineType === 'LOAN_REPAYMENT' && line.loan) {
        const repay = Math.min(amount, line.loan.balance)
        if (repay > 0) {
          const nextLoanBalance = Math.max(0, line.loan.balance - repay)
          await tx.loan.update({
            where: { id: line.loan.id },
            data: {
              balance: nextLoanBalance,
              status: nextLoanBalance <= 0 ? 'COMPLETED' : line.loan.status,
            },
          })

          await tx.repayment.create({
            data: { loanId: line.loan.id, amount: repay, date: now },
          })

          const user = await tx.user.findUnique({
            where: { id: line.userId },
            select: { loanBalance: true },
          })

          await tx.user.update({
            where: { id: line.userId },
            data: { loanBalance: Math.max(0, (user?.loanBalance || 0) - repay) },
          })

          await tx.transaction.create({
            data: {
              userId: line.userId,
              type: 'LOAN_REPAYMENT',
              amount: repay,
              status: 'COMPLETED',
              reference: generateReference(),
              description: `Monthly loan payroll repayment posting (${cycle.period}).`,
            },
          })
        }
      }

      await tx.payrollLine.update({
        where: { id: line.id },
        data: {
          status: PayrollLineStatus.POSTED,
          postedAt: now,
          actualAmount: amount,
        },
      })
    }

    await tx.payrollCycle.update({
      where: { id: cycle.id },
      data: { status: 'POSTED', postedBy: actor, postedAt: now },
    })
  })

  return true
}

export async function autoPostMonthEndIfDue(now = new Date()) {
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth()
  const isDueDay = now.getDate() >= 30 || isLastDayOfMonth

  if (!isDueDay) {
    return { ran: false, reason: 'before_due_day' as const }
  }

  const period = getPeriodForDate(now)
  const cycle = await ensureCycleDraft(period)
  if (!cycle) return { ran: false, reason: 'cycle_missing' as const }
  if (cycle.status === 'POSTED') return { ran: false, reason: 'already_posted' as const }

  if (cycle.status === 'DRAFT') {
    await prisma.payrollCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'FINANCE_CONFIRMED',
        financeConfirmedBy: 'SYSTEM_AUTO',
        financeConfirmedAt: now,
      },
    })
  }

  const posted = await postFinanceConfirmedCycle(cycle.id, 'SYSTEM_AUTO')
  return { ran: posted, reason: posted ? ('posted' as const) : ('not_finance_confirmed' as const) }
}
