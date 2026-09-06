'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Landmark,
  Loader2,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { LOAN_REQUEST_POLICY } from '@/lib/loan-request'
import { SmartSelect } from '@/components/ui/smart-select'
import { PageHeading, StatusBadge } from '@/components/ui/overview'
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
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState({
    loanType: 'Personal',
    duration: '6',
    amount: '',
    purpose: '',
    guarantor1StaffId: '',
    guarantor2StaffId: '',
  })
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const stepTitle = useRef<HTMLHeadingElement>(null)
  const enabled = canSubmit && hasBankDetails && loanEligibility > 0 && !sent
  const eligibilityMessage =
    member.status !== 'ACTIVE'
      ? 'Your membership must be active before you can apply.'
      : monthsServed < LOAN_REQUEST_POLICY.minTenureMonths
        ? `Loans are available after ${LOAN_REQUEST_POLICY.minTenureMonths} months of membership. You have completed ${monthsServed} months.`
        : loanEligibility <= 0
          ? 'Build your thrift savings before applying. Special savings do not count toward loan eligibility.'
          : recentLoans.some((loan) => loan.status === 'PENDING')
            ? 'You already have a loan application under review. Track it in My loans.'
            : 'You have an outstanding loan to repay before applying again. View your balance in My loans.'
  const amount = Number(draft.amount) || 0
  const fee = (amount * LOAN_REQUEST_POLICY.adminChargePercent) / 100
  function change(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    setError('')
  }
  function move(next: number) {
    setStep(next)
    setError('')
    requestAnimationFrame(() => stepTitle.current?.focus())
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled || busy) return
    if (step === 0) {
      if (
        !Number.isInteger(amount) ||
        amount <= 0 ||
        amount > loanEligibility ||
        !draft.purpose.trim()
      ) {
        setError('Enter an amount within your limit and tell us what the loan is for.')
        return
      }
      move(1)
      return
    }
    if (step === 1) {
      const ids = [draft.guarantor1StaffId, draft.guarantor2StaffId].map((value) =>
        value.trim().toUpperCase()
      )
      if (
        ids.some((id) => !id) ||
        ids[0] === ids[1] ||
        ids.includes((member.staffId || '').toUpperCase())
      ) {
        setError('Provide two different members as guarantors. You cannot be your own guarantor.')
        return
      }
      move(2)
      return
    }
    if (!acknowledged) return
    setBusy(true)
    setError('')
    const data = new FormData()
    Object.entries(draft).forEach(([key, value]) => data.set(key, value))
    data.set('acknowledgement', 'on')
    try {
      const result = await submitLoanRequest(data)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSent(true)
      toast.success('Loan request sent for review.')
      router.refresh()
    } catch {
      setError('We could not send your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const steps = ['Loan details', 'Guarantors', 'Review & submit']
  return (
    <div className="mx-auto max-w-[1180px] space-y-8">
      <PageHeading
        eyebrow="YOUR NEXT STEP"
        title="A little support. A bigger possibility."
        description="Plan your loan, choose your guarantors and send it for review."
        actions={
          <Link href="/dashboard/my-loans?view=member" className="btn-secondary">
            My loans <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />
      {sent ? (
        <section className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h2 className="text-2xl font-semibold tracking-normal">Your request is with the team.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            The cooperative will review your {formatCurrency(amount)} request and contact your
            guarantors. You can follow its status in My loans.
          </p>
          <Link href="/dashboard/my-loans?view=member" className="btn-primary mt-7">
            View my request <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_290px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={submit} className="settings-panel">
            <ol className="flex border-b px-5 py-5 sm:px-8" aria-label="Application progress">
              {steps.map((label, index) => (
                <li key={label} className="flex flex-1 items-center gap-2.5">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                      index <= step
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-surface-2 text-muted-foreground'
                    )}
                  >
                    {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span
                    aria-current={index === step ? 'step' : undefined}
                    className={cn(
                      'text-xs font-medium',
                      index === step ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{index === step ? label : ''}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="p-5 sm:p-8">
              {!enabled && (
                <div
                  role="status"
                  className="mb-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
                >
                  {!hasBankDetails ? (
                    <>
                      <p>Add your payout account before applying.</p>
                      <Link
                        className="mt-2 inline-flex items-center gap-1 font-semibold underline"
                        href="/dashboard/profile?view=member"
                      >
                        Update bank details <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </>
                  ) : (
                    <p>{eligibilityMessage}</p>
                  )}
                </div>
              )}
              <h2
                ref={stepTitle}
                tabIndex={-1}
                className="text-xl font-semibold tracking-normal outline-none"
              >
                {
                  [
                    'What do you have in mind?',
                    'Choose your two guarantors.',
                    'One last look before you send.',
                  ][step]
                }
              </h2>
              <p className="mb-7 mt-2 text-xs leading-6 text-muted-foreground">
                {
                  [
                    'Start with the amount you need and a repayment period that works for you.',
                    'Both guarantors must be cooperative members. Only their Staff IDs are needed.',
                    'Check the details below. Your application is not an automatic approval.',
                  ][step]
                }
              </p>
              {step === 0 && (
                <div className="space-y-6">
                  <Field label="How much would you like to borrow?">
                    <div className="flex items-center gap-3 rounded-xl border bg-surface px-5 py-3 focus-within:border-accent">
                      <span className="text-xl text-muted-foreground">₦</span>
                      <input
                        aria-label="Amount requested"
                        name="amount"
                        type="number"
                        min={1}
                        step={1}
                        max={Math.max(1, Math.floor(loanEligibility))}
                        value={draft.amount}
                        onChange={(event) => change('amount', event.target.value)}
                        placeholder="0"
                        required
                        disabled={!enabled}
                        className="w-full min-w-0 bg-transparent !text-3xl font-semibold tracking-normal outline-none"
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Available limit{' '}
                      <span className="font-medium text-accent">
                        {formatCurrency(loanEligibility)}
                      </span>{' '}
                      · Based on thrift savings only
                    </p>
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Loan type">
                      <SmartSelect
                        name="loanType"
                        label="Loan type"
                        value={draft.loanType}
                        onChange={(value) => change('loanType', value)}
                        options={[
                          'Personal',
                          'Emergency',
                          'Education',
                          'Welfare',
                          'Project',
                          'Other',
                        ]}
                        disabled={!enabled}
                      />
                    </Field>
                    <Field label="Repayment period">
                      <SmartSelect
                        name="duration"
                        label="Repayment period"
                        value={draft.duration}
                        onChange={(value) => change('duration', value)}
                        options={[3, 6, 9, 12, 18, 24].map((value) => ({
                          value: String(value),
                          label: `${value} months`,
                        }))}
                        disabled={!enabled}
                      />
                    </Field>
                  </div>
                  <Field label="What will you use it for?">
                    <textarea
                      aria-label="Purpose of loan"
                      name="purpose"
                      required
                      rows={4}
                      disabled={!enabled}
                      value={draft.purpose}
                      onChange={(event) => change('purpose', event.target.value)}
                      placeholder="Tell us a little about the purpose of this loan..."
                      className="w-full resize-y rounded-xl border bg-surface px-4 py-3 text-sm leading-6 outline-none focus:border-accent"
                    />
                  </Field>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-5">
                  {(['guarantor1StaffId', 'guarantor2StaffId'] as const).map((key, index) => (
                    <div key={key} className="rounded-xl border p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-accent">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium">Guarantor {index + 1}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            An existing cooperative member
                          </p>
                        </div>
                      </div>
                      <Field label="Staff ID">
                        <input
                          aria-label={`Guarantor ${index + 1} Staff ID`}
                          name={key}
                          value={draft[key]}
                          onChange={(event) => change(key, event.target.value)}
                          required
                          className="settings-input font-mono"
                          placeholder="Enter Staff ID"
                          disabled={busy}
                        />
                      </Field>
                    </div>
                  ))}
                  <div className="settings-note">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      The admin will contact both members to confirm their agreement before
                      approving your loan. Staff IDs are verified when you submit.
                    </p>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-surface-2/50 p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-sm font-medium">Loan details</h3>
                      <button
                        type="button"
                        onClick={() => move(0)}
                        disabled={busy}
                        className="text-xs font-medium text-accent"
                      >
                        Change details
                      </button>
                    </div>
                    <dl className="space-y-3">
                      <ReviewRow label="Amount" value={formatCurrency(amount)} />
                      <ReviewRow label="Type" value={draft.loanType} />
                      <ReviewRow label="Repayment period" value={`${draft.duration} months`} />
                      <ReviewRow
                        label="Administration charge"
                        value={`${formatCurrency(fee)} (${LOAN_REQUEST_POLICY.adminChargePercent}%)`}
                      />
                      <ReviewRow label="Total repayable" value={formatCurrency(amount + fee)} />
                    </dl>
                    <p className="mt-5 border-t pt-4 text-xs leading-6 text-muted-foreground">
                      {draft.purpose}
                    </p>
                  </div>
                  <div className="rounded-xl border p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-medium">Guarantors</h3>
                      <button
                        type="button"
                        onClick={() => move(1)}
                        disabled={busy}
                        className="text-xs font-medium text-accent"
                      >
                        Change guarantors
                      </button>
                    </div>
                    <p className="text-sm">
                      Staff ID {draft.guarantor1StaffId}{' '}
                      <span className="mx-2 text-muted-foreground">&</span> Staff ID{' '}
                      {draft.guarantor2StaffId}
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-5">
                    <input
                      type="checkbox"
                      name="acknowledgement"
                      checked={acknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked)}
                      required
                      disabled={busy}
                      className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                    />
                    <span className="text-xs leading-6 text-muted-foreground">
                      I hereby declare that the information provided is true and correct. I agree to
                      abide by the rules of the cooperative society and authorize the deduction of
                      loan repayments from my salary.
                    </span>
                  </label>
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  {error}
                </p>
              )}
            </div>
            <footer className="settings-savebar">
              <span className="flex-1 text-xs text-muted-foreground">Step {step + 1} of 3</span>
              {step > 0 && (
                <button
                  type="button"
                  className="settings-discard"
                  disabled={busy}
                  onClick={() => move(step - 1)}
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={!enabled || busy || (step === 2 && !acknowledged)}
                className="btn-primary"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Sending...' : step === 2 ? 'Send application' : 'Continue'}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>
            </footer>
          </form>
          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="rounded-2xl bg-[#193f30] p-6 text-white">
              <div className="mb-6 flex items-center justify-between text-xs text-white/85">
                <span>Your borrowing limit</span>
                <Landmark className="h-4 w-4" />
              </div>
              <p className="text-[2rem] font-medium leading-tight tracking-normal">
                {formatCurrency(loanEligibility)}
              </p>
              <p className="mt-3 text-xs leading-6 text-white/85">
                Up to {LOAN_REQUEST_POLICY.maxSavingsMultiplier}× your total thrift savings. Special
                savings are not included.
              </p>
              <div className="mt-6 border-t border-white/15 pt-4">
                <p className="flex justify-between gap-3 text-xs">
                  <span className="text-white/85">Thrift savings</span>
                  <span>{formatCurrency(member.balance)}</span>
                </p>
              </div>
            </section>
            <section className="px-2">
              <h3 className="mb-4 text-xs font-semibold">Applying as</h3>
              <p className="text-sm font-medium">{member.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Staff ID {member.staffId} · Joined {formatDate(member.createdAt)}
              </p>
              <div className="mt-5 border-t pt-4">
                <p className="text-xs text-muted-foreground">Payout destination</p>
                <p className="mt-2 text-sm">{member.bankName || 'No bank details'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {member.bankAccountNumber || 'Add an account in your profile'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{member.bankAccountName}</p>
              </div>
            </section>
            {!!recentLoans.length && (
              <section className="border-t px-2 pt-5">
                <div className="mb-3 flex justify-between">
                  <h3 className="text-xs font-semibold">Recent requests</h3>
                  <Link href="/dashboard/my-loans?view=member" className="text-xs text-accent">
                    View all
                  </Link>
                </div>
                {recentLoans.slice(0, 3).map((loan) => (
                  <div key={loan.id} className="flex items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(loan.amount)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(loan.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={loan.status} />
                  </div>
                ))}
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-medium">{label}</p>
      {children}
    </div>
  )
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
