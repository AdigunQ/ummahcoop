'use client'

import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { formatCurrency } from '@/lib/utils'

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

  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="border-b border-slate-200 bg-[#07130d] px-6 py-7 text-[#f7f3ea] lg:border-b-0 lg:border-r lg:px-7 lg:py-8">
              <UmmahLogo textClassName="text-white" />
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">Join Ummah Coop</h1>

              <p className="mt-6 text-sm text-[#c6d7c7]">
                Already a Member?{' '}
                <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-[#8bd49d] hover:text-[#9ce3ad]">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </p>
            </section>

            <section className="px-6 py-7 sm:px-7 sm:py-8">
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <Field label="Staff ID" error={errors.staffId}>
                  <input
                    value={form.staffId}
                    onChange={onTextChange('staffId')}
                    type="text"
                    placeholder="e.g. OPS-1042"
                    className={inputClassName}
                    autoComplete="off"
                    autoFocus
                  />
                </Field>

                <Field label="Full name" error={errors.name}>
                  <input
                    value={form.name}
                    onChange={onTextChange('name')}
                    type="text"
                    placeholder="Your full name"
                    className={inputClassName}
                    autoComplete="name"
                  />
                </Field>

                <Field label="Phone number" error={errors.phone}>
                  <input
                    value={form.phone}
                    onChange={onTextChange('phone')}
                    type="tel"
                    placeholder="08012345678"
                    className={inputClassName}
                    autoComplete="tel"
                  />
                </Field>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Savings plan</p>
                      <h2 className="mt-2 text-sm font-semibold text-slate-950">Choose one or both</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Pick the savings type you want and set the amount for each month.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
                      <Check className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                  <SavingsPlanCard
                    inputId="thrift-plan"
                    title="Thrift saving"
                    description="Regular monthly savings"
                    enabled={form.thriftEnabled}
                    onToggle={onTogglePlan('thriftEnabled')}
                    amount={form.thriftAmount}
                    onAmountChange={onAmountChange('thriftAmount')}
                    error={errors.thriftAmount}
                  />
                  <SavingsPlanCard
                    inputId="special-plan"
                    title="Special savings"
                    description="An extra savings bucket"
                    enabled={form.specialEnabled}
                    onToggle={onTogglePlan('specialEnabled')}
                    amount={form.specialAmount}
                    onAmountChange={onAmountChange('specialAmount')}
                    error={errors.specialAmount}
                  />
                  </div>

                  {errors.plan ? <p className="mt-3 text-xs font-medium text-rose-600">{errors.plan}</p> : null}

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total monthly contribution</p>
                      <p className="mt-1 text-xs text-slate-400">Automatically used for your member setup</p>
                    </div>
                    <p className="text-lg font-bold text-slate-950">
                      {formatCurrency(
                        (form.thriftEnabled ? Number(form.thriftAmount || 0) : 0) +
                          (form.specialEnabled ? Number(form.specialAmount || 0) : 0)
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1c15] px-5 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#13261c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit application
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8bd49d] focus:ring-4 focus:ring-[#8bd49d]/15'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </label>
  )
}

function SavingsPlanCard({
  inputId,
  title,
  description,
  enabled,
  onToggle,
  amount,
  onAmountChange,
  error,
}: {
  inputId: string
  title: string
  description: string
  enabled: boolean
  onToggle: (event: ChangeEvent<HTMLInputElement>) => void
  amount: string
  onAmountChange: (event: ChangeEvent<HTMLInputElement>) => void
  error?: string
}) {
  return (
    <div className={`rounded-2xl border p-4 transition ${enabled ? 'border-emerald-200 bg-white shadow-sm' : 'border-slate-200 bg-white/80'}`}>
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <label htmlFor={inputId} className="cursor-pointer">
              <p className="text-sm font-semibold text-slate-950">{title}</p>
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            </label>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {enabled ? 'Selected' : 'Optional'}
            </p>
          </div>

          <div className="mt-3">
            <input
              type="number"
              min="0"
              step="100"
              disabled={!enabled}
              value={amount}
              onChange={onAmountChange}
              placeholder="0"
              aria-label={`${title} monthly amount`}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8bd49d] focus:ring-4 focus:ring-[#8bd49d]/15 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
