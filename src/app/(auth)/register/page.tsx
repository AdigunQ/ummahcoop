'use client'

import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { ArrowRight, Hash, Loader2, LockKeyhole, ShieldCheck, User, Wallet } from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { ThemeToggle } from '@/components/theme-toggle'

type FormState = {
  staffId: string
  name: string
  savingsPlan: SavingsPlan | ''
  thriftAmount: string
  specialAmount: string
  password: string
  confirmPassword: string
}

type SavingsPlan = 'THRIFT' | 'SPECIAL' | 'BOTH'
type FormErrors = Partial<Record<'staffId' | 'name' | 'savingsPlan' | 'thriftAmount' | 'specialAmount' | 'password' | 'confirmPassword', string>>

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState<FormState>({
    staffId: '',
    name: '',
    savingsPlan: '',
    thriftAmount: '',
    specialAmount: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})

  const onTextChange =
    (field: keyof Pick<FormState, 'staffId' | 'name' | 'password' | 'confirmPassword'>) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
      setErrors((current) => ({ ...current, [field]: undefined }))
    }

  const onAmountChange =
    (field: 'thriftAmount' | 'specialAmount') => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
      setErrors((current) => ({ ...current, [field]: undefined }))
    }

  const onSavingsPlanChange = (savingsPlan: SavingsPlan) => {
    setForm((current) => ({ ...current, savingsPlan }))
    setErrors((current) => ({ ...current, savingsPlan: undefined }))
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    if (!form.staffId.trim()) nextErrors.staffId = 'Staff ID is required'
    if (!form.name.trim()) nextErrors.name = 'Full name is required'
    if (!form.savingsPlan) nextErrors.savingsPlan = 'Choose a savings plan'

    const usesThrift = form.savingsPlan === 'THRIFT' || form.savingsPlan === 'BOTH'
    const usesSpecial = form.savingsPlan === 'SPECIAL' || form.savingsPlan === 'BOTH'
    const thriftAmount = Number(form.thriftAmount)
    const specialAmount = Number(form.specialAmount)

    if (usesThrift && (!form.thriftAmount.trim() || !Number.isFinite(thriftAmount) || thriftAmount <= 0)) {
      nextErrors.thriftAmount = 'Enter a valid monthly thrift amount'
    }
    if (usesSpecial && (!form.specialAmount.trim() || !Number.isFinite(specialAmount) || specialAmount <= 0)) {
      nextErrors.specialAmount = 'Enter a valid monthly special amount'
    }
    if (!form.password) nextErrors.password = 'Create a password'
    else if (form.password.length < 6) nextErrors.password = 'Use at least 6 characters'
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Confirm your password'
    else if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsLoading(true)

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: form.staffId.trim(),
          name: form.name.trim(),
          savingsPlan: form.savingsPlan,
          thriftAmount: usesThrift ? thriftAmount : undefined,
          specialAmount: usesSpecial ? specialAmount : undefined,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      toast.success('Application submitted. Wait for admin approval.')
      router.push('/login')
    } catch (error: any) {
      toast.error(error.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.35] dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 glow-radial" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <UmmahLogo markClassName="h-9 w-9" textClassName="text-foreground" compactText />
        </Link>
        <ThemeToggle />
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-5xl items-center gap-10 px-6 pb-12 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <div className="space-y-6">
          <div
            className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Member registration
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Open your cooperative account
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Keep it short. Send your Staff ID, full name, savings plan, monthly amount, and password.
              Admin will review the request before access is granted.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MiniCard label="Staff ID" value="Unique member code" />
            <MiniCard label="Name" value="Full legal name" />
            <MiniCard label="Savings" value="Thrift or special" />
            <MiniCard label="Password" value="You choose it" />
          </div>

          <div className="rounded-2xl border bg-surface p-4 text-sm text-muted-foreground" style={{ borderColor: 'rgb(var(--border))' }}>
            <p className="font-semibold text-foreground">What happens next</p>
            <p className="mt-1 leading-relaxed">
              Your record is created as pending. The admin will review your selected
              savings plan and monthly amounts before approving the account.
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <form onSubmit={onSubmit} className="space-y-5 p-6 sm:p-8" noValidate>
            <div>
              <p className="label-eyebrow">Registration details</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Member form</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose how you want to save and enter the amount you plan to contribute each month.
              </p>
            </div>

            <div className="space-y-4">
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

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-foreground">Savings plan</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ['THRIFT', 'Thrift savings', 'Regular savings and loan eligibility'],
                    ['SPECIAL', 'Special savings', 'A separate savings balance'],
                    ['BOTH', 'Both', 'Save in both plans'],
                  ] as const).map(([value, label, description]) => (
                    <label
                      key={value}
                      className={
                        'cursor-pointer rounded-xl border p-3 transition ' +
                        (form.savingsPlan === value
                          ? 'border-accent bg-accent/10'
                          : 'border-[rgb(var(--border))] bg-surface hover:border-accent/50')
                      }
                    >
                      <input
                        type="radio"
                        name="savingsPlan"
                        value={value}
                        checked={form.savingsPlan === value}
                        onChange={() => onSavingsPlanChange(value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
                    </label>
                  ))}
                </div>
                {errors.savingsPlan && <p className="mt-1.5 text-xs text-rose-500">{errors.savingsPlan}</p>}
              </fieldset>

              {form.savingsPlan && (
                <div className="space-y-4 rounded-2xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Monthly contribution</p>
                    <p className="mt-1 text-xs text-muted-foreground">Enter the amount for each savings plan you selected.</p>
                  </div>

                  {(form.savingsPlan === 'THRIFT' || form.savingsPlan === 'BOTH') && (
                    <Field label="Monthly thrift savings" error={errors.thriftAmount} icon={Wallet}>
                      <input
                        data-testid="register-thrift-amount-input"
                        value={form.thriftAmount}
                        onChange={onAmountChange('thriftAmount')}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder="e.g. 10000"
                        className="input-base pl-10"
                      />
                    </Field>
                  )}

                  {(form.savingsPlan === 'SPECIAL' || form.savingsPlan === 'BOTH') && (
                    <Field label="Monthly special savings" error={errors.specialAmount} icon={Wallet}>
                      <input
                        data-testid="register-special-amount-input"
                        value={form.specialAmount}
                        onChange={onAmountChange('specialAmount')}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder="e.g. 5000"
                        className="input-base pl-10"
                      />
                    </Field>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Create password" error={errors.password} icon={LockKeyhole}>
                  <input
                    data-testid="register-password-input"
                    value={form.password}
                    onChange={onTextChange('password')}
                    type="password"
                    minLength={6}
                    placeholder="At least 6 characters"
                    className="input-base pl-10"
                    autoComplete="new-password"
                  />
                </Field>

                <Field label="Confirm password" error={errors.confirmPassword} icon={LockKeyhole}>
                  <input
                    data-testid="register-confirm-password-input"
                    value={form.confirmPassword}
                    onChange={onTextChange('confirmPassword')}
                    type="password"
                    minLength={6}
                    placeholder="Repeat your password"
                    className="input-base pl-10"
                    autoComplete="new-password"
                  />
                </Field>
              </div>
            </div>

            <button
              type="submit"
              data-testid="register-submit-button"
              disabled={isLoading}
              className="btn-primary w-full !py-3.5"
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

            <div className="rounded-xl border bg-surface-2 px-4 py-3 text-xs text-muted-foreground" style={{ borderColor: 'rgb(var(--border))' }}>
              Your Staff ID is your login username. Use the password you create here after approval.
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Already a member?{' '}
              <Link href="/login" className="font-semibold text-accent hover:underline" data-testid="register-login-link">
                Sign in here
              </Link>
            </p>
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

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-surface p-4" style={{ borderColor: 'rgb(var(--border))' }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
