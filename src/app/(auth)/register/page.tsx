'use client'

import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import {
  ArrowRight,
  Hash,
  Loader2,
  LockKeyhole,
  PiggyBank,
  User,
  Wallet,
  Layers3,
  ShieldCheck,
} from 'lucide-react'
import { AuthShell } from '@/components/public/auth-shell'

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
type FormErrors = Partial<
  Record<
    | 'staffId'
    | 'name'
    | 'savingsPlan'
    | 'thriftAmount'
    | 'specialAmount'
    | 'password'
    | 'confirmPassword',
    string
  >
>

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
    (field: keyof Pick<FormState, 'staffId' | 'name' | 'password' | 'confirmPassword'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
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
    if (isLoading) return

    const nextErrors: FormErrors = {}
    if (!form.staffId.trim()) nextErrors.staffId = 'Staff ID is required'
    if (!form.name.trim()) nextErrors.name = 'Full name is required'
    if (!form.savingsPlan) nextErrors.savingsPlan = 'Choose a savings plan'

    const usesThrift = form.savingsPlan === 'THRIFT' || form.savingsPlan === 'BOTH'
    const usesSpecial = form.savingsPlan === 'SPECIAL' || form.savingsPlan === 'BOTH'
    const thriftAmount = Number(form.thriftAmount)
    const specialAmount = Number(form.specialAmount)

    if (
      usesThrift &&
      (!form.thriftAmount.trim() || !Number.isFinite(thriftAmount) || thriftAmount <= 0)
    ) {
      nextErrors.thriftAmount = 'Enter a valid monthly thrift amount'
    }
    if (
      usesSpecial &&
      (!form.specialAmount.trim() || !Number.isFinite(specialAmount) || specialAmount <= 0)
    ) {
      nextErrors.specialAmount = 'Enter a valid monthly special amount'
    }
    if (!form.password) nextErrors.password = 'Create a password'
    else if (form.password.length < 6) nextErrors.password = 'Use at least 6 characters'
    if (!form.confirmPassword) nextErrors.confirmPassword = 'Confirm your password'
    else if (form.password !== form.confirmPassword)
      nextErrors.confirmPassword = 'Passwords do not match'

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
    <AuthShell registration>
      <div className="auth-form-heading">
        <h1>Become a member.</h1>
        <p>A few details to start your savings journey.</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={isLoading} className="space-y-6">
          <section className="auth-register-section" aria-labelledby="registration-details">
            <h2 id="registration-details" className="auth-section-title">
              <span aria-hidden="true">1</span> Your details
            </h2>
            <div className="grid gap-4 sm:grid-cols-[.65fr_1fr]">
              <Field label="Staff ID" error={errors.staffId} icon={Hash}>
                <input
                  data-testid="register-staffid-input"
                  value={form.staffId}
                  onChange={onTextChange('staffId')}
                  type="text"
                  placeholder="e.g. 009709"
                  className="input-base pl-10"
                  autoComplete="username"
                  aria-invalid={!!errors.staffId}
                />
              </Field>
              <Field label="Full name" error={errors.name} icon={User}>
                <input
                  data-testid="register-name-input"
                  value={form.name}
                  onChange={onTextChange('name')}
                  type="text"
                  placeholder="Your full name"
                  className="input-base pl-10"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                />
              </Field>
            </div>
          </section>
          <section className="auth-register-section" aria-labelledby="registration-savings">
            <h2 id="registration-savings" className="auth-section-title">
              <span aria-hidden="true">2</span> Your monthly savings
            </h2>
            <fieldset>
              <legend className="sr-only">How would you like to save?</legend>
              <div className="auth-savings-options">
                {(
                  [
                    ['THRIFT', 'Thrift savings', 'Regular monthly savings', PiggyBank],
                    ['SPECIAL', 'Special savings', 'A separate savings pot', Wallet],
                    ['BOTH', 'Both plans', 'Thrift and special', Layers3],
                  ] as const
                ).map(([value, label, description, Icon]) => (
                  <label key={value} className="savings-choice">
                    <input
                      type="radio"
                      name="savingsPlan"
                      value={value}
                      checked={form.savingsPlan === value}
                      onChange={() => onSavingsPlanChange(value)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-accent" />
                      <span className="choice-dot h-4 w-4 rounded-full border" aria-hidden="true" />
                    </div>
                    <span className="mt-1 text-sm font-semibold">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </label>
                ))}
              </div>
              {errors.savingsPlan && (
                <p role="alert" className="mt-2 text-xs text-rose-600">
                  {errors.savingsPlan}
                </p>
              )}
            </fieldset>
            {form.savingsPlan && (
              <div className="auth-amount-fields">
                {(form.savingsPlan === 'THRIFT' || form.savingsPlan === 'BOTH') && (
                  <Field label="Thrift / month (₦)" error={errors.thriftAmount} icon={Wallet}>
                    <input
                      data-testid="register-thrift-amount-input"
                      value={form.thriftAmount}
                      onChange={onAmountChange('thriftAmount')}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="10,000"
                      className="input-base pl-10"
                    />
                  </Field>
                )}
                {(form.savingsPlan === 'SPECIAL' || form.savingsPlan === 'BOTH') && (
                  <Field label="Special / month (₦)" error={errors.specialAmount} icon={Wallet}>
                    <input
                      data-testid="register-special-amount-input"
                      value={form.specialAmount}
                      onChange={onAmountChange('specialAmount')}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      placeholder="5,000"
                      className="input-base pl-10"
                    />
                  </Field>
                )}
              </div>
            )}
          </section>
          <section className="auth-register-section" aria-labelledby="registration-password">
            <h2 id="registration-password" className="auth-section-title">
              <span aria-hidden="true">3</span> Create your password
            </h2>
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
                  placeholder="Repeat password"
                  className="input-base pl-10"
                  autoComplete="new-password"
                />
              </Field>
            </div>
          </section>
          <div>
            <button
              type="submit"
              data-testid="register-submit-button"
              disabled={isLoading}
              className="btn-primary w-full !py-3.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting application...
                </>
              ) : (
                <>
                  Create my account <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <div className="auth-approval-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>
                An admin will review your application. Once approved, sign in with your Staff ID and
                password.
              </p>
            </div>
          </div>
        </fieldset>
      </form>
      <p className="auth-form-alternate">
        Already a member?{' '}
        <Link
          href="/login"
          className="font-semibold text-accent hover:underline"
          data-testid="register-login-link"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
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
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-rose-600">
          {error}
        </p>
      )}
    </label>
  )
}
