'use client'

import { useMemo } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowRight, Building2, CalendarDays, FileText, Hash, Loader2, Mail, PhoneCall, ShieldCheck, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { submitLoanRequest } from './actions'

type RecentLoan = {
  id: string
  amount: number
  duration: number
  purpose: string
  status: string
  createdAt: string
  interestRate: number
  totalRepayable: number | null
}

type MemberSnapshot = {
  name: string | null
  email: string
  phone: string | null
  staffId: string | null
  department: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  balance: number
  specialBalance: number
  monthlyContribution: number | null
  createdAt: string
  status: string
}

type LoanRequestFormProps = {
  member: MemberSnapshot
  recentLoans: RecentLoan[]
  loanEligibility: number
  monthsServed: number
  canSubmit: boolean
  hasBankDetails: boolean
}

export function LoanRequestForm({
  member,
  recentLoans,
  loanEligibility,
  monthsServed,
  canSubmit,
  hasBankDetails,
}: LoanRequestFormProps) {
  async function handleSubmit(formData: FormData) {
    const res = await submitLoanRequest(formData)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success('Loan request submitted for admin review.')
    }
  }

  const memberSince = useMemo(() => formatDate(member.createdAt), [member.createdAt])

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="card overflow-hidden">
        <div className="border-b px-6 py-5" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label-eyebrow">Loan request</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Fill the cooperative loan form</h1>
            </div>
            <span className="pill bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              5% admin charge
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            You must be active for at least 6 months and your request cannot exceed 2x your thrift savings.
          </p>
        </div>

        <form action={handleSubmit} className="grid gap-6 p-6 lg:grid-cols-[1fr_0.95fr]" noValidate>
          <div className="space-y-5">
            <fieldset className="space-y-4 rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
              <legend className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Applicant details
              </legend>

              <ReadOnlyRow icon={User} label="Full name" value={member.name || 'Member'} />
              <ReadOnlyRow icon={Hash} label="Staff No" value={member.staffId || 'N/A'} />
              <ReadOnlyRow icon={CalendarDays} label="Member since" value={memberSince} />
              <ReadOnlyRow icon={Building2} label="Organisation" value="Ummah Coop / FAAN" />
              <ReadOnlyRow icon={FileText} label="Department / Unit" value={member.department || 'N/A'} />
              <ReadOnlyRow icon={FileText} label="Position / Rank" value="Member" />
              <ReadOnlyRow icon={Mail} label="Email" value={member.email} mono />
              <ReadOnlyRow icon={PhoneCall} label="Phone" value={member.phone || 'N/A'} />
            </fieldset>

            <fieldset className="space-y-4 rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
              <legend className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Loan details
              </legend>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type of loan
                </label>
                <select name="loanType" defaultValue="Personal" className="input-base" required disabled={!canSubmit || !hasBankDetails}>
                  <option value="Personal">Personal</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Education">Education</option>
                  <option value="Welfare">Welfare</option>
                  <option value="Project">Project</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Amount requested
                  </label>
                  <input
                    name="amount"
                    type="number"
                    min={1}
                    max={Math.max(1, Math.floor(loanEligibility))}
                    step={1}
                    placeholder="e.g. 150000"
                    className="input-base"
                    required
                    disabled={!canSubmit || !hasBankDetails}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Max allowed: {formatCurrency(loanEligibility)}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Loan duration
                  </label>
                  <select name="duration" defaultValue="6" className="input-base" required disabled={!canSubmit || !hasBankDetails}>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="9">9 months</option>
                    <option value="12">12 months</option>
                    <option value="18">18 months</option>
                    <option value="24">24 months</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Purpose of loan
                </label>
                <textarea
                  name="purpose"
                  rows={4}
                  placeholder="Tell us what the loan is for"
                  className="input-base resize-none"
                  required
                  disabled={!canSubmit || !hasBankDetails}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
              <legend className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Guarantors
              </legend>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Enter the Staff ID only. Admin will confirm both guarantors before approval.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Guarantor 1 Staff ID
                  </label>
                  <input
                    name="guarantor1StaffId"
                    type="text"
                    placeholder="e.g. FAAN-001"
                    className="input-base font-mono uppercase"
                    required
                    disabled={!canSubmit || !hasBankDetails}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Guarantor 2 Staff ID
                  </label>
                  <input
                    name="guarantor2StaffId"
                    type="text"
                    placeholder="e.g. FAAN-002"
                    className="input-base font-mono uppercase"
                    required
                    disabled={!canSubmit || !hasBankDetails}
                  />
                </div>
              </div>
            </fieldset>

            {!hasBankDetails && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Add your bank details in Profile before requesting a loan.
              </div>
            )}

            {!canSubmit && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Loan requests are only available for active members with at least 6 months on the platform and no pending or outstanding loan.
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || !hasBankDetails}
              className="btn-primary w-full !py-3.5"
            >
              Submit loan request
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border bg-surface p-5" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="label-eyebrow">Current snapshot</p>
              <div className="mt-4 space-y-3">
                <SummaryRow label="Thrift savings" value={formatCurrency(member.balance)} />
                <SummaryRow label="Special savings" value={formatCurrency(member.specialBalance)} />
                <SummaryRow label="Monthly contribution" value={formatCurrency(member.monthlyContribution || 0)} />
                <SummaryRow label="Loan eligibility" value={formatCurrency(loanEligibility)} />
                <SummaryRow label="Months on platform" value={`${monthsServed} months`} />
              </div>
            </section>

            <section className="rounded-2xl border bg-surface p-5" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="label-eyebrow">Bank details</p>
              <div className="mt-4 space-y-2 text-sm">
                <SummaryRow label="Bank" value={member.bankName || 'Not set'} />
                <SummaryRow label="Account name" value={member.bankAccountName || 'Not set'} />
                <SummaryRow label="Account number" value={member.bankAccountNumber || 'Not set'} mono />
              </div>
            </section>

            <section className="rounded-2xl border bg-surface p-5" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="label-eyebrow">Recent requests</p>
              <div className="mt-4 space-y-3">
                {recentLoans.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground" style={{ borderColor: 'rgb(var(--border))' }}>
                    No loan requests yet.
                  </div>
                ) : (
                  recentLoans.map((loan) => (
                    <div key={loan.id} className="rounded-xl border bg-surface-2 p-3" style={{ borderColor: 'rgb(var(--border))' }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{formatCurrency(loan.amount)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {loan.duration} months · {loan.purpose}
                          </p>
                        </div>
                        <StatusPill status={loan.status} />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Submitted {formatDistanceToNowStrict(new Date(loan.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </form>
      </section>
    </div>
  )
}

function ReadOnlyRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-surface px-4 py-3" style={{ borderColor: 'rgb(var(--border))' }}>
      <Icon className="h-4 w-4 flex-none text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`ml-auto truncate text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
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
