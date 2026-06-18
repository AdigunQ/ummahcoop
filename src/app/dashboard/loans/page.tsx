import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { differenceInMonths } from 'date-fns'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'
import { LOAN_POLICY } from '@/lib/constants'
import { LOAN_REQUEST_POLICY, sanitizeLoanApplicationData } from '@/lib/loan-request'
import { PRIVILEGE_CODES, canAccessWithPrivileges } from '@/lib/access'

async function reviewLoan(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.REVIEW_LOANS))) {
    redirect('/dashboard')
  }

  const loanId = String(formData.get('loanId') || '')
  const action = String(formData.get('action') || '')

  if (!loanId || !['approve', 'reject'].includes(action)) {
    return
  }

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      user: {
        select: {
          balance: true,
          loanBalance: true,
          createdAt: true,
        },
      },
    },
  })

  if (!loan) {
    return
  }

  const approved = action === 'approve'
  const eligibility = (loan.user?.balance || 0) * LOAN_POLICY.maxSavingsMultiplier
  const hasOutstandingLoan = (loan.user?.loanBalance || 0) > 0
  const tenureOk = loan.user?.createdAt ? differenceInMonths(new Date(), loan.user.createdAt) >= LOAN_REQUEST_POLICY.minTenureMonths : false
  const cannotApprove = loan.amount > eligibility || hasOutstandingLoan || !tenureOk

  if (approved && cannotApprove) {
    await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'REJECTED',
        approvedBy: session.user.id,
        approvedAt: new Date(),
        notes: 'Rejected: member does not meet tenure or eligibility requirements.',
      },
    })
    revalidatePath('/dashboard/loans')
    return
  }

  const chargeRate = loan.interestRate || LOAN_REQUEST_POLICY.adminChargePercent
  const totalRepayable = loan.amount + loan.amount * (chargeRate / 100)

  await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: approved ? 'APPROVED' : 'REJECTED',
      approvedBy: session.user.id,
      approvedAt: new Date(),
      totalRepayable,
      monthlyPayment: totalRepayable / loan.duration,
      balance: approved ? totalRepayable : 0,
      notes: approved
        ? `Loan approved with ${chargeRate}% admin charge. Repayment will be deducted monthly.`
        : 'Loan request declined after review.',
    },
  })

  if (approved) {
    await prisma.user.update({
      where: { id: loan.userId },
      data: {
        loanBalance: { increment: totalRepayable },
      },
    })

    await prisma.transaction.create({
      data: {
        userId: loan.userId,
        type: 'LOAN_DISBURSEMENT',
        amount: loan.amount,
        status: 'COMPLETED',
        reference: `TRX-LOAN-${loan.id.slice(-6).toUpperCase()}`,
        description: `Loan approved: ${loan.purpose}`,
      },
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/loans')
  revalidatePath('/dashboard/transactions')
}

export default async function LoansPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || !session?.user?.id) {
    redirect('/login')
  }

  if (!(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.REVIEW_LOANS))) {
    redirect('/dashboard')
  }

  const [pendingLoans, recentLoans] = await Promise.all([
    prisma.loan.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            staffId: true,
            department: true,
            createdAt: true,
            balance: true,
            loanBalance: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountName: true,
          },
        },
      },
    }),
    prisma.loan.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: { approvedAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ])
  const hasTenureRequirement = LOAN_REQUEST_POLICY.minTenureMonths > 0

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden p-6 sm:p-7">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-eyebrow">Admin · Loans</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">Loan requests</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review pending requests, verify guarantors, and approve only when the request stays within the 2x thrift limit{hasTenureRequirement ? ` and the member meets the ${LOAN_REQUEST_POLICY.minTenureMonths}-month rule` : ''}.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Pending requests"
          value={pendingLoans.length.toString()}
          tone="amber"
          caption="Awaiting review"
        />
        <MetricCard
          label="Pending exposure"
          value={formatCurrency(pendingLoans.reduce((sum, loan) => sum + loan.amount, 0))}
          tone="blue"
          caption="Gross request value"
        />
        <MetricCard
          label="Recently decided"
          value={recentLoans.length.toString()}
          tone="green"
          caption="Last 10 decisions"
        />
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-end justify-between gap-4 border-b px-6 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            <p className="label-eyebrow">Pending queue</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Requests for approval</h2>
          </div>
        </div>

        {pendingLoans.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">No pending loan requests.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {pendingLoans.map((loan) => {
              const application = sanitizeLoanApplicationData(loan.applicationData)
              const maxEligible = loan.user?.balance ? loan.user.balance * LOAN_POLICY.maxSavingsMultiplier : 0
              const tenureMonths = loan.user?.createdAt ? differenceInMonths(new Date(), loan.user.createdAt) : 0
              const hasOutstandingLoan = (loan.user?.loanBalance || 0) > 0
              const canApprove = !hasOutstandingLoan && loan.amount <= maxEligible && tenureMonths >= LOAN_REQUEST_POLICY.minTenureMonths

              return (
                <div key={loan.id} className="px-6 py-5">
                  <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{loan.user?.name || 'Unknown Member'}</p>
                          <p className="text-sm text-muted-foreground">
                            {loan.user?.email} · {loan.user?.phone || 'No phone'} · Staff ID: {loan.user?.staffId || 'N/A'}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Department: {loan.user?.department || 'N/A'} · Member since {loan.user?.createdAt ? formatDate(loan.user.createdAt) : 'N/A'}
                          </p>
                        </div>
                        <StatusBadge status={loan.status} />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <InfoCard label="Requested amount" value={formatCurrency(loan.amount)} />
                        <InfoCard label="Loan duration" value={`${loan.duration} months`} />
                        <InfoCard label="Loan type" value={application?.loan.type || 'General'} />
                        <InfoCard label="Max eligible" value={formatCurrency(maxEligible)} />
                      </div>

                      <div className="rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Purpose</p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">{loan.purpose}</p>
                      </div>

                      {application && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <InfoCard label="Thrift savings" value={formatCurrency(application.applicant.thriftSavings)} />
                          <InfoCard label="Special savings" value={formatCurrency(application.applicant.specialSavings)} />
                          <InfoCard label="Monthly contribution" value={formatCurrency(application.applicant.monthlyContribution)} />
                          <InfoCard label="Applicant phone" value={application.applicant.phone || 'N/A'} />
                        </div>
                      )}

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bank details</p>
                          <div className="mt-2 space-y-1 text-sm">
                            <p>{loan.user?.bankName || 'N/A'}</p>
                            <p className="font-mono">{loan.user?.bankAccountNumber || 'N/A'}</p>
                            <p>{loan.user?.bankAccountName || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Guarantors</p>
                          <div className="mt-2 space-y-1 text-sm">
                            {application?.guarantors.length ? (
                              application.guarantors.map((guarantor) => (
                                <div key={guarantor.staffId} className="space-y-0.5">
                                  <p className="font-semibold">{guarantor.staffId} · {guarantor.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {guarantor.department || 'No department'} · {guarantor.phone || 'No phone'}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-muted-foreground">Guarantor data not stored.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasOutstandingLoan && (
                        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                          Member has an outstanding loan. New requests should not be approved.
                        </p>
                      )}
                      {hasTenureRequirement && tenureMonths < LOAN_REQUEST_POLICY.minTenureMonths && (
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Member has only been active for {tenureMonths} month{tenureMonths === 1 ? '' : 's'}.
                          A 6-month membership period is required.
                        </p>
                      )}

                      <p className="text-sm text-muted-foreground">
                        Submitted {formatDateTime(loan.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-col justify-between gap-3 rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">Review actions</p>
                        <p className="text-muted-foreground">The repayment charge is {loan.interestRate || LOAN_REQUEST_POLICY.adminChargePercent}%.</p>
                        {loan.notes && <p className="text-muted-foreground">{loan.notes}</p>}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <form action={reviewLoan}>
                          <input type="hidden" name="loanId" value={loan.id} />
                          <input type="hidden" name="action" value="approve" />
                          <button
                            type="submit"
                            disabled={!canApprove}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            Approve
                          </button>
                        </form>

                        <form action={reviewLoan}>
                          <input type="hidden" name="loanId" value={loan.id} />
                          <input type="hidden" name="action" value="reject" />
                          <button
                            type="submit"
                            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </form>
                      </div>

                      {!canApprove && (
                        <p className="text-xs text-amber-700">
                          Approval is blocked until the request meets the savings rules{hasTenureRequirement ? ' and tenure rule' : ''}.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b px-6 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
          <p className="label-eyebrow">Recent decisions</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">Approved and rejected loans</h2>
        </div>

        {recentLoans.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">No reviewed loan requests yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {recentLoans.map((loan) => (
              <div key={loan.id} className="flex flex-col gap-2 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{loan.user?.name || 'Unknown Member'}</p>
                  <p className="text-muted-foreground">{formatCurrency(loan.amount)} · {loan.duration} months</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{loan.approvedAt ? formatDateTime(loan.approvedAt) : '-'}</span>
                  <StatusBadge status={loan.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
  caption,
}: {
  label: string
  value: string
  tone: 'amber' | 'blue' | 'green'
  caption: string
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs opacity-70">{caption}</p>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-surface-2 p-3" style={{ borderColor: 'rgb(var(--border))' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    REJECTED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    COMPLETED: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${styles[status as keyof typeof styles] || 'bg-surface-2 text-muted-foreground'}`}>
      {status}
    </span>
  )
}
