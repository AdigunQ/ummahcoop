import { AdminSubmit } from '@/components/admin/admin-collection'
import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import { FormSelect } from '@/components/ui/smart-select'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime, generateReference } from '@/lib/utils'
import { ensureCycleDraft } from '@/lib/payroll'

function isValidPeriod(period: string) {
  return /^\d{4}-\d{2}$/.test(period)
}

async function generateCycle(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const period = String(formData.get('period') || '')
  if (!isValidPeriod(period)) return

  await ensureCycleDraft(period)

  revalidatePath('/dashboard/month-end')
}

async function updateLine(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const lineId = String(formData.get('lineId') || '')
  const actualAmount = Number(formData.get('actualAmount') || 0)
  const status = String(formData.get('status') || 'PENDING')
  const reason = String(formData.get('reason') || '').trim()

  if (!lineId || !Number.isFinite(actualAmount) || actualAmount < 0) return
  if (!['PENDING', 'EXCLUDED'].includes(status)) return

  const line = await prisma.payrollLine.findUnique({
    where: { id: lineId },
    include: { cycle: { select: { status: true } } },
  })
  if (!line || line.cycle.status !== 'DRAFT') return

  const nextStatus: 'PENDING' | 'EXCLUDED' = status === 'EXCLUDED' ? 'EXCLUDED' : 'PENDING'

  await prisma.payrollLine.update({
    where: { id: lineId },
    data: {
      actualAmount,
      status: nextStatus,
      reason: reason || null,
    },
  })

  revalidatePath('/dashboard/month-end')
}

async function confirmFinance(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const cycleId = String(formData.get('cycleId') || '')
  if (!cycleId) return

  await prisma.payrollCycle.update({
    where: { id: cycleId },
    data: {
      status: 'FINANCE_CONFIRMED',
      financeConfirmedBy: session.user.name || session.user.email,
      financeConfirmedAt: new Date(),
    },
  })

  revalidatePath('/dashboard/month-end')
}

async function postCycle(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const cycleId = String(formData.get('cycleId') || '')
  if (!cycleId) return

  const cycle = await prisma.payrollCycle.findUnique({
    where: { id: cycleId },
    include: {
      lines: {
        where: { status: 'PENDING' },
        include: { loan: true },
      },
    },
  })

  if (!cycle || cycle.status !== 'FINANCE_CONFIRMED') return

  const now = new Date()
  const postedBy = session.user.name || session.user.email || 'Admin'

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
          status: 'POSTED',
          postedAt: now,
          actualAmount: amount,
        },
      })
    }

    await tx.payrollCycle.update({
      where: { id: cycle.id },
      data: { status: 'POSTED', postedBy, postedAt: now },
    })
  })

  revalidatePath('/dashboard/month-end')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard')
}

export default async function MonthEndPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const [latestCycle, recentCycles] = await Promise.all([
    prisma.payrollCycle.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        lines: {
          orderBy: [{ lineType: 'asc' }, { createdAt: 'asc' }],
          include: {
            user: { select: { name: true, staffId: true, department: true } },
          },
        },
      },
    }),
    prisma.payrollCycle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  const pendingLines = latestCycle?.lines.filter((l) => l.status === 'PENDING') || []
  const pendingAmount = pendingLines.reduce(
    (sum, l) => sum + (l.actualAmount ?? l.expectedAmount),
    0
  )

  return (
    <div className="admin-page">
      <AdminHeading
        section="Finance"
        title="Month-end posting"
        description={
          <>
            Draft deductions first. Post to balances only after salary payment and cooperative
            transfer are confirmed.
          </>
        }
      />

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Generate New Payroll Cycle</h2>
        <form action={generateCycle} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Period</label>
            <input
              aria-label="Period"
              type="month"
              name="period"
              required
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <AdminSubmit pendingLabel="Processing..."
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Generate Draft
          </AdminSubmit>
        </form>
      </div>

      {latestCycle ? (
        <>
          <AdminStats
            items={[
              { label: 'Current Cycle', value: latestCycle.period },
              { label: 'Status', value: latestCycle.status },
              { label: 'Pending Lines', value: pendingLines.length.toString() },
              { label: 'Pending Amount', value: formatCurrency(pendingAmount) },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3">
            {latestCycle.status === 'DRAFT' && (
              <form action={confirmFinance}>
                <input type="hidden" name="cycleId" value={latestCycle.id} />
                <AdminSubmit pendingLabel="Processing..."
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Confirm Salary Paid + Transfer Received
                </AdminSubmit>
              </form>
            )}
            {latestCycle.status === 'FINANCE_CONFIRMED' && (
              <form action={postCycle}>
                <input type="hidden" name="cycleId" value={latestCycle.id} />
                <AdminSubmit pendingLabel="Processing..."
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Post Cycle
                </AdminSubmit>
              </form>
            )}
            {latestCycle.status === 'POSTED' && (
              <span className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                Posted at {latestCycle.postedAt ? formatDateTime(latestCycle.postedAt) : '-'}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Cycle Lines</h2>
            </div>
            {latestCycle.lines.length === 0 ? (
              <div className="px-6 py-10 text-center text-muted-foreground">
                No lines in this cycle.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {latestCycle.lines.map((line) => (
                  <div key={line.id} className="px-6 py-4">
                    <form action={updateLine} className="grid grid-cols-1 gap-3 xl:grid-cols-8">
                      <input type="hidden" name="lineId" value={line.id} />
                      <div className="xl:col-span-2">
                        <p className="text-sm font-semibold text-foreground">
                          {line.user?.name || 'Unknown Member'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {line.user?.staffId || 'N/A'} · {line.user?.department || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="text-sm font-semibold text-foreground">
                          {line.lineType === 'SAVINGS' ? 'Savings' : 'Loan Repayment'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expected</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(line.expectedAmount)}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Actual</label>
                        <input
                          aria-label="Actual Amount"
                          name="actualAmount"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={line.actualAmount ?? line.expectedAmount}
                          disabled={latestCycle.status !== 'DRAFT'}
                          className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-sm outline-none focus:border-primary-500 disabled:bg-surface-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Status</label>
                        <FormSelect
                          aria-label="Status"
                          name="status"
                          defaultValue={line.status}
                          disabled={latestCycle.status !== 'DRAFT' || line.status === 'POSTED'}
                          className="min-w-40 w-full"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="EXCLUDED">Excluded</option>
                          {line.status === 'POSTED' && <option value="POSTED">Posted</option>}
                        </FormSelect>
                      </div>
                      <div className="xl:col-span-2">
                        <label className="text-xs text-muted-foreground">Reason</label>
                        <input
                          aria-label="Reason"
                          name="reason"
                          type="text"
                          defaultValue={line.reason || ''}
                          disabled={latestCycle.status !== 'DRAFT'}
                          className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-sm outline-none focus:border-primary-500 disabled:bg-surface-2"
                        />
                      </div>
                      {latestCycle.status === 'DRAFT' && (
                        <div className="xl:col-span-8">
                          <AdminSubmit pendingLabel="Processing..."
                            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-black"
                          >
                            Save Line
                          </AdminSubmit>
                        </div>
                      )}
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Cycles</h2>
            </div>
            <div className="divide-y divide-border">
              {recentCycles.map((cycle) => (
                <div key={cycle.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <span className="font-medium text-foreground">{cycle.period}</span>
                  <span className="text-muted-foreground">{cycle.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
          No cycle yet. Generate a month-end draft.
        </div>
      )}
    </div>
  )
}
