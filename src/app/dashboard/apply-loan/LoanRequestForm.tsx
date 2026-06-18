'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowRight, BadgeCheck, Building2, CalendarDays, Landmark, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { LOAN_REQUEST_POLICY } from '@/lib/loan-request'
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
  const [acknowledged, setAcknowledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    const res = await submitLoanRequest(formData)
    setIsSubmitting(false)

    if (res?.error) {
      toast.error(res.error)
      return
    }

    toast.success('Loan request submitted for admin review.')
  }

  const memberSince = useMemo(() => formatDate(member.createdAt), [member.createdAt])
  const canSend = canSubmit && hasBankDetails && acknowledged && !isSubmitting

  return (
    <div className="space-y-6">
      <header className="border-b border-gray-200 pb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Loan application</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-950">Request cooperative loan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Complete the details below. Admin will review your request, confirm guarantors, and contact you before approval.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Maximum request</p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">{formatCurrency(loanEligibility)}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form action={handleSubmit} className="rounded-lg border border-gray-200 bg-white shadow-sm" noValidate>
          <SectionHeader
            number="01"
            title="Applicant"
            description="These details are pulled from your member profile."
          />
          <div className="grid gap-px border-b border-gray-200 bg-gray-200 md:grid-cols-2">
            <InfoCell icon={UserRound} label="Full name" value={member.name || 'Member'} />
            <InfoCell icon={BadgeCheck} label="Staff ID" value={member.staffId || 'N/A'} mono />
            <InfoCell icon={CalendarDays} label="Member since" value={memberSince} />
            <InfoCell icon={Building2} label="Department" value={member.department || 'N/A'} />
          </div>

          <SectionHeader
            number="02"
            title="Loan details"
            description="Keep the amount within your thrift savings eligibility."
          />
          <div className="grid gap-5 border-b border-gray-200 p-5 md:grid-cols-2">
            <Field label="Type of loan">
              <select name="loanType" defaultValue="Personal" className="input-base" required disabled={!canSubmit || !hasBankDetails}>
                <option value="Personal">Personal</option>
                <option value="Emergency">Emergency</option>
                <option value="Education">Education</option>
                <option value="Welfare">Welfare</option>
                <option value="Project">Project</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Loan duration">
              <select name="duration" defaultValue="6" className="input-base" required disabled={!canSubmit || !hasBankDetails}>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="9">9 months</option>
                <option value="12">12 months</option>
                <option value="18">18 months</option>
                <option value="24">24 months</option>
              </select>
            </Field>

            <Field label="Amount requested" hint={`Limit: ${formatCurrency(loanEligibility)}`}>
              <input
                name="amount"
                type="number"
                min={1}
                max={Math.max(1, Math.floor(loanEligibility))}
                step={1}
                placeholder="150000"
                className="input-base"
                required
                disabled={!canSubmit || !hasBankDetails}
              />
            </Field>

            <Field label="Purpose of loan" className="md:row-span-2">
              <textarea
                name="purpose"
                rows={5}
                placeholder="Briefly state what this loan is for"
                className="input-base resize-none"
                required
                disabled={!canSubmit || !hasBankDetails}
              />
            </Field>
          </div>

          <SectionHeader
            number="03"
            title="Guarantors"
            description="Enter Staff IDs only. Admin will confirm both members before approval."
          />
          <div className="grid gap-5 border-b border-gray-200 p-5 md:grid-cols-2">
            <Field label="Guarantor 1 Staff ID">
              <input
                name="guarantor1StaffId"
                type="text"
                placeholder="e.g. 009709"
                className="input-base font-mono uppercase"
                required
                disabled={!canSubmit || !hasBankDetails}
              />
            </Field>

            <Field label="Guarantor 2 Staff ID">
              <input
                name="guarantor2StaffId"
                type="text"
                placeholder="e.g. 010214"
                className="input-base font-mono uppercase"
                required
                disabled={!canSubmit || !hasBankDetails}
              />
            </Field>
          </div>

          <div className="space-y-4 p-5">
            {!hasBankDetails && (
              <Notice tone="amber">
                Add bank details in your profile before submitting a loan request.
              </Notice>
            )}

            {!canSubmit && (
              <Notice tone="blue">
                {LOAN_REQUEST_POLICY.minTenureMonths > 0
                  ? `Loan requests are available for active members who have spent at least ${LOAN_REQUEST_POLICY.minTenureMonths} months on the platform and have no pending or outstanding loan.`
                  : 'Loan requests are available for active members with no pending or outstanding loan.'}
              </Notice>
            )}

            <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-4">
              <input
                type="checkbox"
                name="acknowledgement"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-700"
              />
              <span className="text-sm leading-6 text-gray-700">
                I hereby declare that the information provided is true and correct. I agree to abide by the rules of
                the cooperative society and authorize the deduction of loan repayments from my salary.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting request
                </>
              ) : (
                <>
                  Submit loan request
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <h2 className="text-base font-semibold text-gray-950">Eligibility check</h2>
            </div>
            <div className="mt-5 space-y-4">
              <Metric label="Thrift savings" value={formatCurrency(member.balance)} />
              <Metric label="Special savings" value={formatCurrency(member.specialBalance)} />
              <Metric label="Monthly contribution" value={formatCurrency(member.monthlyContribution || 0)} />
              <Metric label="Months on platform" value={`${monthsServed} months`} />
            </div>
            <p className="mt-5 border-t border-gray-200 pt-4 text-xs leading-5 text-gray-500">
              {LOAN_REQUEST_POLICY.minTenureMonths > 0
                ? `Requests are checked against thrift savings, active membership, ${LOAN_REQUEST_POLICY.minTenureMonths}-month tenure, and existing loan status.`
                : 'Requests are checked against thrift savings, active membership, and existing loan status.'}
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-emerald-700" />
              <h2 className="text-base font-semibold text-gray-950">Bank destination</h2>
            </div>
            <div className="mt-5 space-y-4">
              <Metric label="Bank" value={member.bankName || 'Not set'} />
              <Metric label="Account name" value={member.bankAccountName || 'Not set'} />
              <Metric label="Account number" value={member.bankAccountNumber || 'Not set'} mono />
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-950">Recent loan requests</h2>
            <div className="mt-4 space-y-3">
              {recentLoans.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">
                  No loan requests yet.
                </div>
              ) : (
                recentLoans.map((loan) => (
                  <div key={loan.id} className="rounded-lg border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-950">{formatCurrency(loan.amount)}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {loan.duration} months · {loan.purpose}
                        </p>
                      </div>
                      <StatusPill status={loan.status} />
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Submitted {formatDistanceToNowStrict(new Date(loan.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function SectionHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 border-b border-gray-200 px-5 py-4">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800">
        {number}
      </span>
      <div>
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">{label}</label>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function InfoCell({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-emerald-700" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
      </div>
      <p className={`mt-2 truncate text-sm font-semibold text-gray-950 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold text-gray-950 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'amber' | 'blue'; children: React.ReactNode }) {
  const classes = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-blue-200 bg-blue-50 text-blue-900'

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles = {
    PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
    COMPLETED: 'bg-sky-50 text-sky-700 ring-sky-200',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${styles[status as keyof typeof styles] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
      {status}
    </span>
  )
}
