'use client'

import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import {
  ArrowRight,
  Check,
  Hash,
  Loader2,
  PhoneCall,
  PiggyBank,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

type FormState = {
  staffId: string
  name: string
  phone: string
  thriftEnabled: boolean
  thriftAmount: string
  specialEnabled: boolean
  specialAmount: string
}

type FormErrors = Partial<
  Record<'staffId' | 'name' | 'phone' | 'thriftAmount' | 'specialAmount' | 'plan', string>
>

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState<FormState>({
    staffId: '',
    name: '',
    phone: '',
    thriftEnabled: false,
    thriftAmount: '',
    specialEnabled: false,
    specialAmount: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})

  const onTextChange = (field: 'staffId' | 'name' | 'phone') => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const onTogglePlan =
    (field: 'thriftEnabled' | 'specialEnabled') => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.checked }))
      setErrors((current) => ({ ...current, plan: undefined }))
    }

  const onAmountChange = (field: 'thriftAmount' | 'specialAmount') => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined, plan: undefined }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    if (!form.staffId.trim()) nextErrors.staffId = 'Staff ID is required'
    if (!form.name.trim()) nextErrors.name = 'Full name is required'
    if (!form.phone.trim()) nextErrors.phone = 'Phone number is required'
    if (form.phone.trim() && form.phone.trim().length < 10) {
      nextErrors.phone = 'Phone number must be at least 10 digits'
    }
    if (!form.thriftEnabled && !form.specialEnabled) {
      nextErrors.plan = 'Choose Thrift saving, Special saving, or both.'
    }

    const thriftAmount = form.thriftEnabled ? Number(form.thriftAmount) : 0
    const specialAmount = form.specialEnabled ? Number(form.specialAmount) : 0

    if (form.thriftEnabled && (!Number.isFinite(thriftAmount) || thriftAmount <= 0)) {
      nextErrors.thriftAmount = 'Enter a valid thrift saving amount'
    }

    if (form.specialEnabled && (!Number.isFinite(specialAmount) || specialAmount <= 0)) {
      nextErrors.specialAmount = 'Enter a valid special savings amount'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: form.staffId.trim(),
          name: form.name.trim(),
          phone: form.phone.trim(),
          monthlyContribution: thriftAmount,
          specialContribution: specialAmount,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      toast.success('Application submitted. Wait for admin approval.')
      router.push('/login')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const total =
    (form.thriftEnabled ? Number(form.thriftAmount || 0) : 0) +
    (form.specialEnabled ? Number(form.specialAmount || 0) : 0)

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.35] dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 glow-radial" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/70 text-accent-foreground shadow-sm">
            <span className="text-sm font-bold tracking-tight">U</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Ummah Cooperative</p>
            <p className="text-[11px] text-muted-foreground">FAAN Staff Multipurpose</p>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-12 lg:px-10">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Membership application
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Open your cooperative account
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            Fill in your details and choose your monthly contribution plan.
            An admin will review and approve your account.
          </p>
        </div>

        <div className="card overflow-hidden">
          <form onSubmit={onSubmit} className="grid gap-0 lg:grid-cols-[1fr_1.1fr]" noValidate>
            {/* Left: Personal details */}
            <div className="border-b p-6 sm:p-8 lg:border-b-0 lg:border-r" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="label-eyebrow">Step 1</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Personal details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Used to identify you across cooperative records.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Staff ID" error={errors.staffId} icon={Hash}>
                  <input
                    data-testid="register-staffid-input"
                    value={form.staffId}
                    onChange={onTextChange('staffId')}
                    type="text"
                    placeholder="e.g. OPS-1042"
                    className="input-base pl-10"
                    autoComplete="off"
                    autoFocus
                  />
                </Field>

                <Field label="Full name" error={errors.name} icon={User}>
                  <input
                    data-testid="register-name-input"
                    value={form.name}
                    onChange={onTextChange('name')}
                    type="text"
                    placeholder="As it appears on records"
                    className="input-base pl-10"
                    autoComplete="name"
                  />
                </Field>

                <Field label="Phone number" error={errors.phone} icon={PhoneCall}>
                  <input
                    data-testid="register-phone-input"
                    value={form.phone}
                    onChange={onTextChange('phone')}
                    type="tel"
                    placeholder="08012345678"
                    className="input-base pl-10"
                    autoComplete="tel"
                  />
                </Field>
              </div>

              <div className="mt-7 flex items-start gap-3 rounded-xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-emerald-500" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Already a member?{' '}
                  <Link href="/login" className="font-semibold text-accent hover:underline" data-testid="register-login-link">
                    Sign in here
                  </Link>
                  . Your application status will be sent to the email tied to your Staff ID.
                </p>
              </div>
            </div>

            {/* Right: Savings plan */}
            <div className="p-6 sm:p-8">
              <p className="label-eyebrow">Step 2</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Choose your savings plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick one or both. Amounts deduct monthly.
              </p>

              <div className="mt-5 space-y-3">
                <SavingsPlanCard
                  inputId="thrift-plan"
                  testIdPrefix="thrift"
                  title="Thrift saving"
                  description="Regular monthly contribution"
                  icon={PiggyBank}
                  enabled={form.thriftEnabled}
                  onToggle={onTogglePlan('thriftEnabled')}
                  amount={form.thriftAmount}
                  onAmountChange={onAmountChange('thriftAmount')}
                  error={errors.thriftAmount}
                />
                <SavingsPlanCard
                  inputId="special-plan"
                  testIdPrefix="special"
                  title="Special savings"
                  description="A separate goal-oriented bucket"
                  icon={Wallet}
                  enabled={form.specialEnabled}
                  onToggle={onTogglePlan('specialEnabled')}
                  amount={form.specialAmount}
                  onAmountChange={onAmountChange('specialAmount')}
                  error={errors.specialAmount}
                />
              </div>

              {errors.plan && (
                <p className="mt-3 text-xs font-medium text-rose-500" data-testid="register-plan-error">{errors.plan}</p>
              )}

              <div
                className="mt-5 flex items-center justify-between rounded-xl border bg-surface-2 px-4 py-3"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div>
                  <p className="label-eyebrow">Total monthly</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Combined from selected plans</p>
                </div>
                <p className="text-xl font-semibold tracking-tight" data-testid="register-total-amount">
                  {formatCurrency(total)}
                </p>
              </div>

              <button
                type="submit"
                data-testid="register-submit-button"
                disabled={isLoading}
                className="btn-primary mt-6 w-full !py-3.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit application
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                You'll be notified once an admin approves your account.
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}

function Field({
  label,
  error,
  icon: Icon,
  children,
}: {
  label: string
  error?: string
  icon: any
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>}
    </label>
  )
}

function SavingsPlanCard({
  inputId,
  testIdPrefix,
  title,
  description,
  icon: Icon,
  enabled,
  onToggle,
  amount,
  onAmountChange,
  error,
}: {
  inputId: string
  testIdPrefix: string
  title: string
  description: string
  icon: any
  enabled: boolean
  onToggle: (event: ChangeEvent<HTMLInputElement>) => void
  amount: string
  onAmountChange: (event: ChangeEvent<HTMLInputElement>) => void
  error?: string
}) {
  return (
    <div
      className={`group relative rounded-2xl border p-4 transition-all ${
        enabled
          ? 'border-accent/40 bg-accent/[0.04] ring-1 ring-accent/20'
          : 'bg-surface hover:bg-surface-2'
      }`}
      style={{ borderColor: enabled ? undefined : 'rgb(var(--border))' }}
    >
      <div className="flex items-start gap-3">
        <label htmlFor={inputId} className="flex flex-1 cursor-pointer items-start gap-3">
          <div className="relative mt-0.5 flex h-5 w-5 flex-none items-center justify-center">
            <input
              id={inputId}
              data-testid={`register-${testIdPrefix}-toggle`}
              type="checkbox"
              checked={enabled}
              onChange={onToggle}
              className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border transition-colors checked:border-accent checked:bg-accent"
              style={{ borderColor: 'rgb(var(--border))' }}
            />
            {enabled && (
              <Check className="pointer-events-none absolute h-3.5 w-3.5 text-accent-foreground" strokeWidth={3} />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${enabled ? 'text-accent' : 'text-muted-foreground'}`} />
              <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </label>
        <span
          className={`pill ${
            enabled ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-muted-foreground'
          }`}
        >
          {enabled ? 'Selected' : 'Optional'}
        </span>
      </div>

      {enabled && (
        <div className="mt-4 pl-8">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              ₦
            </span>
            <input
              data-testid={`register-${testIdPrefix}-amount`}
              type="number"
              min="0"
              step="100"
              value={amount}
              onChange={onAmountChange}
              placeholder="0"
              aria-label={`${title} monthly amount`}
              className="input-base pl-8"
            />
          </div>
          {error && <p className="mt-1.5 text-xs font-medium text-rose-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
