import { AdminSubmit } from '@/components/admin/admin-collection'
import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import { AdminCollection, AdminReviewItem } from '@/components/admin/admin-collection'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { differenceInMonths } from 'date-fns'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'
import { LOAN_REQUEST_POLICY, getLoanLimit, sanitizeLoanApplicationData } from '@/lib/loan-request'
import { PRIVILEGE_CODES, canAccessWithPrivileges } from '@/lib/access'
import { getCurrentMemberLiveDataset } from '@/lib/current-member-data'
import { resolveVoucherPeriod } from '@/lib/vouchers'
import { getMemberFinanceSummary } from '@/lib/member-finance'
import { saveLoanDecision } from '@/lib/review-decisions'

async function reviewLoan(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (
    !session?.user?.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.REVIEW_LOANS
    ))
  ) {
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
          staffId: true,
        },
      },
    },
  })

  if (!loan || loan.status !== 'PENDING') {
    redirect('/dashboard/loans')
  }

  const approved = action === 'approve'
  const eligibility = getLoanLimit(loan.user?.balance || 0)
  const financeSummary = await getMemberFinanceSummary(loan.userId, loan.user?.staffId)
  const hasOutstandingLoan = (loan.user?.loanBalance || 0) > 0 || financeSummary.loanOutstanding > 0
  const tenureOk = loan.user?.createdAt
    ? differenceInMonths(new Date(), loan.user.createdAt) >= LOAN_REQUEST_POLICY.minTenureMonths
    : false
  const cannotApprove = loan.amount > eligibility || hasOutstandingLoan || !tenureOk

  if (approved && cannotApprove) {
    await prisma.loan.updateMany({
      where: { id: loanId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        approvedBy: session.user.id,
        approvedAt: new Date(),
        notes: 'Rejected: member does not meet tenure or eligibility requirements.',
      },
    })
    revalidatePath('/dashboard/loans')
    revalidatePath('/dashboard/my-loans')
    revalidatePath('/dashboard/apply-loan')
    revalidatePath('/dashboard')
    redirect('/dashboard/loans')
  }

  await saveLoanDecision(loan, approved, session.user.id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/loans')
  revalidatePath('/dashboard/transactions')
  revalidatePath('/dashboard/my-loans')
  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/apply-loan')
  redirect('/dashboard/loans')
}

export default async function LoansPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || !session?.user?.id) {
    redirect('/login')
  }

  if (
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.REVIEW_LOANS
    ))
  ) {
    redirect('/dashboard')
  }

  const [pendingLoans, recentLoans, currentDataset] = await Promise.all([
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
      orderBy: [{ approvedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
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
    getCurrentMemberLiveDataset(resolveVoucherPeriod().period),
  ])
  const ledgerLoans = currentDataset.rows.filter((row) => row.loanAmount > 0)
  const ledgerLoanByStaffId = new Map(
    ledgerLoans.map((row) => [row.staffId.trim().toUpperCase(), row.loanAmount])
  )
  const hasTenureRequirement = LOAN_REQUEST_POLICY.minTenureMonths > 0

  return (
    <div className="admin-page">
      <AdminHeading
        section="Requests"
        title="Loan requests"
        description="Review applications, eligibility and guarantors before approval."
      />

      <AdminStats
        items={[
          {
            label: 'Pending requests',
            value: pendingLoans.length.toString(),
            note: 'Awaiting review',
          },
          {
            label: 'Pending exposure',
            value: formatCurrency(pendingLoans.reduce((sum, loan) => sum + loan.amount, 0)),
            note: 'Gross request value',
          },
          {
            label: 'Recently decided',
            value: recentLoans.length.toString(),
            note: 'Last 10 decisions',
          },
          {
            label: 'Ledger active loans',
            value: ledgerLoans.length.toString(),
            note: formatCurrency(ledgerLoans.reduce((sum, row) => sum + row.loanAmount, 0)),
          },
        ]}
      />

      <section className="card overflow-hidden">
        <div
          className="flex items-end justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div>
            <p className="label-eyebrow">Pending queue</p>
            <h2 className="mt-1 text-base font-semibold tracking-normal">Requests for approval</h2>
          </div>
        </div>

        {pendingLoans.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No pending loan requests.
          </div>
        ) : (
          <div className="admin-queue">
            <AdminCollection>
              {pendingLoans.map((loan) => {
                const application = sanitizeLoanApplicationData(loan.applicationData)
                const maxEligible = getLoanLimit(loan.user?.balance || 0)
                const tenureMonths = loan.user?.createdAt
                  ? differenceInMonths(new Date(), loan.user.createdAt)
                  : 0
                const hasOutstandingLoan =
                  (loan.user?.loanBalance || 0) > 0 ||
                  (ledgerLoanByStaffId.get((loan.user?.staffId || '').trim().toUpperCase()) || 0) >
                    0
                const canApprove =
                  !hasOutstandingLoan &&
                  loan.amount <= maxEligible &&
                  tenureMonths >= LOAN_REQUEST_POLICY.minTenureMonths

                return (
                  <AdminReviewItem
                    key={loan.id}
                    heading={loan.user?.name || 'Unnamed member'}
                    meta={loan.purpose}
                    status={loan.status}
                    amount={formatCurrency(loan.amount)}
                    searchText={
                      (loan.user?.name || '') +
                      ' ' +
                      loan.purpose +
                      ' ' +
                      (loan.user?.staffId || '')
                    }
                  >
                    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">
                              {loan.user?.name || 'Unknown Member'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {loan.user?.email} · {loan.user?.phone || 'No phone'} · Staff ID:{' '}
                              {loan.user?.staffId || 'N/A'}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Department: {loan.user?.department || 'N/A'} · Member since{' '}
                              {loan.user?.createdAt ? formatDate(loan.user.createdAt) : 'N/A'}
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

                        <div
                          className="rounded-2xl border bg-surface-2 p-4"
                          style={{ borderColor: 'rgb(var(--border))' }}
                        >
                          <p className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                            Purpose
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-foreground">
                            {loan.purpose}
                          </p>
                        </div>

                        {application && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <InfoCard
                              label="Thrift savings"
                              value={formatCurrency(application.applicant.thriftSavings)}
                            />
                            <InfoCard
                              label="Special savings"
                              value={formatCurrency(application.applicant.specialSavings)}
                            />
                            <InfoCard
                              label="Monthly contribution"
                              value={formatCurrency(application.applicant.monthlyContribution)}
                            />
                            <InfoCard
                              label="Applicant phone"
                              value={application.applicant.phone || 'N/A'}
                            />
                          </div>
                        )}

                        <div className="grid gap-3 md:grid-cols-2">
                          <div
                            className="rounded-2xl border bg-surface-2 p-4"
                            style={{ borderColor: 'rgb(var(--border))' }}
                          >
                            <p className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                              Bank details
                            </p>
                            <div className="mt-2 space-y-1 text-sm">
                              <p>{loan.user?.bankName || 'N/A'}</p>
                              <p className="font-mono">{loan.user?.bankAccountNumber || 'N/A'}</p>
                              <p>{loan.user?.bankAccountName || 'N/A'}</p>
                            </div>
                          </div>

                          <div
                            className="rounded-2xl border bg-surface-2 p-4"
                            style={{ borderColor: 'rgb(var(--border))' }}
                          >
                            <p className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
                              Guarantors
                            </p>
                            <div className="mt-2 space-y-1 text-sm">
                              {application?.guarantors.length ? (
                                application.guarantors.map((guarantor) => (
                                  <div key={guarantor.staffId} className="space-y-0.5">
                                    <p className="font-semibold">
                                      {guarantor.staffId} · {guarantor.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {guarantor.department || 'No department'} ·{' '}
                                      {guarantor.phone || 'No phone'}
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
                        {hasTenureRequirement &&
                          tenureMonths < LOAN_REQUEST_POLICY.minTenureMonths && (
                            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              Member has only been active for {tenureMonths} month
                              {tenureMonths === 1 ? '' : 's'}. A 6-month membership period is
                              required.
                            </p>
                          )}

                        <p className="text-sm text-muted-foreground">
                          Submitted {formatDateTime(loan.createdAt)}
                        </p>
                      </div>

                      <div
                        className="flex flex-col justify-between gap-3 rounded-2xl border bg-surface-2 p-4"
                        style={{ borderColor: 'rgb(var(--border))' }}
                      >
                        <div className="space-y-2 text-sm">
                          <p className="font-semibold">Review actions</p>
                          <p className="text-muted-foreground">
                            The repayment charge is{' '}
                            {loan.interestRate || LOAN_REQUEST_POLICY.adminChargePercent}%.
                          </p>
                          {loan.notes && <p className="text-muted-foreground">{loan.notes}</p>}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <form action={reviewLoan}>
                            <input type="hidden" name="loanId" value={loan.id} />
                            <input type="hidden" name="action" value="approve" />
                            <AdminSubmit pendingLabel="Processing..."
                              disabled={!canApprove}
                              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Approve
                            </AdminSubmit>
                          </form>

                          <form action={reviewLoan}>
                            <input type="hidden" name="loanId" value={loan.id} />
                            <input type="hidden" name="action" value="reject" />
                            <AdminSubmit pendingLabel="Processing..."
                              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                            >
                              Reject
                            </AdminSubmit>
                          </form>
                        </div>

                        {!canApprove && (
                          <p className="text-xs text-amber-700">
                            Approval is blocked until the request meets the savings rules
                            {hasTenureRequirement ? ' and tenure rule' : ''}.
                          </p>
                        )}
                      </div>
                    </div>
                  </AdminReviewItem>
                )
              })}
            </AdminCollection>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b px-6 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
          <p className="label-eyebrow">Imported member data</p>
          <h2 className="mt-1 text-base font-semibold tracking-normal">
            Current ledger loan exposure
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            These facilities came from the latest Member Data upload and are now included in active
            totals.
          </p>
        </div>
        {ledgerLoans.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No loan amounts in the current ledger.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {ledgerLoans.map((row) => (
              <div
                key={row.staffId}
                className="flex flex-col gap-2 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-muted-foreground">Staff ID: {row.staffId}</p>
                </div>
                <p className="font-semibold">{formatCurrency(row.loanAmount)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b px-6 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
          <p className="label-eyebrow">Recent decisions</p>
          <h2 className="mt-1 text-base font-semibold tracking-normal">
            Approved and rejected loans
          </h2>
        </div>

        {recentLoans.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No reviewed loan requests yet.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {recentLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex flex-col gap-2 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold">{loan.user?.name || 'Unknown Member'}</p>
                  <p className="text-muted-foreground">
                    {formatCurrency(loan.amount)} · {loan.duration} months
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {loan.approvedAt ? formatDateTime(loan.approvedAt) : '-'}
                  </span>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl border bg-surface-2 p-3"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <p className="text-xs font-semibold normal-case tracking-normal text-muted-foreground">
        {label}
      </p>
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
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold normal-case tracking-normal ${styles[status as keyof typeof styles] || 'bg-surface-2 text-muted-foreground'}`}
    >
      {status}
    </span>
  )
}
