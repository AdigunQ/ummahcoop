'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

export function RegisterForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    staffId: '',
    name: '',
    phone: '',
    savingsPlan: 'thrift' as 'thrift' | 'special' | 'both',
    monthlyAmount: '',
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const errors = {
    staffId: touched.staffId && !formData.staffId.trim() ? 'Staff ID is required'
      : formData.staffId && formData.staffId.trim().length < 3 ? 'Too short' : '',
    name: touched.name && !formData.name.trim() ? 'Full name is required' : '',
    phone: touched.phone && !formData.phone.trim() ? 'Phone number is required'
      : formData.phone && !/^[+]?[\d\s()-]{8,}$/.test(formData.phone) ? 'Enter a valid phone number' : '',
    monthlyAmount: touched.monthlyAmount && formData.monthlyAmount && Number(formData.monthlyAmount) < 1000
      ? 'Minimum ₦1,000' : '',
  }

  const hasErrors = Object.values(errors).some(e => e)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ staffId: true, name: true, phone: true, monthlyAmount: true })
    if (hasErrors) return

    startTransition(async () => {
      setError('')
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staffId: formData.staffId.trim(),
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            savingsPlan: formData.savingsPlan,
            monthlyAmount: formData.monthlyAmount ? Number(formData.monthlyAmount) : undefined,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Registration failed' }))
          throw new Error(data.error || 'Registration failed')
        }
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2500)
      } catch (err: any) {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    })
  }

  const update = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  if (success) {
    return (
      <div className="animate-scaleIn space-y-4 rounded-xl border p-8 text-center" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--surface))' }}>
        <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: 'rgb(var(--success))' }} />
        <h3 className="text-lg font-medium" style={{ color: 'rgb(var(--ink))' }}>Registration submitted</h3>
        <p className="text-sm" style={{ color: 'rgb(var(--ink-muted))' }}>
          Your membership is pending admin review. You will be notified when approved. Redirecting to login…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div className="animate-scaleIn rounded-lg border px-4 py-3 text-sm" role="alert"
          style={{ background: 'rgb(var(--danger) / 0.06)', borderColor: 'rgb(var(--danger) / 0.2)', color: 'rgb(var(--danger))' }}>
          {error}
        </div>
      )}

      {/* Staff ID */}
      <div>
        <label htmlFor="staffId" className="mb-1.5 block text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>
          Staff ID <span style={{ color: 'rgb(var(--danger))' }}>*</span>
        </label>
        <input
          id="staffId" name="staffId" type="text" autoComplete="off" required autoFocus
          value={formData.staffId}
          onChange={e => update('staffId', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, staffId: true }))}
          placeholder="e.g. 009709"
          className={`input-base ${errors.staffId ? 'input-error' : ''}`}
          aria-invalid={!!errors.staffId}
          aria-describedby={errors.staffId ? 'staffId-error' : undefined}
        />
        {errors.staffId && <p id="staffId-error" className="mt-1.5 text-xs" style={{ color: 'rgb(var(--danger))' }} role="alert">{errors.staffId}</p>}
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>
          Full name <span style={{ color: 'rgb(var(--danger))' }}>*</span>
        </label>
        <input
          id="name" name="name" type="text" autoComplete="name" required
          value={formData.name}
          onChange={e => update('name', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, name: true }))}
          placeholder="e.g. Ibrahim Musa"
          className={`input-base ${errors.name ? 'input-error' : ''}`}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && <p id="name-error" className="mt-1.5 text-xs" style={{ color: 'rgb(var(--danger))' }} role="alert">{errors.name}</p>}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>
          Phone number <span style={{ color: 'rgb(var(--danger))' }}>*</span>
        </label>
        <input
          id="phone" name="phone" type="tel" autoComplete="tel" required
          value={formData.phone}
          onChange={e => update('phone', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, phone: true }))}
          placeholder="e.g. 0803 123 4567"
          className={`input-base ${errors.phone ? 'input-error' : ''}`}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
        />
        {errors.phone && <p id="phone-error" className="mt-1.5 text-xs" style={{ color: 'rgb(var(--danger))' }} role="alert">{errors.phone}</p>}
      </div>

      {/* Savings plan */}
      <div>
        <label className="mb-1.5 block text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>
          Savings plan
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'thrift', label: 'Thrift' },
            { value: 'special', label: 'Special' },
            { value: 'both', label: 'Both' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('savingsPlan', opt.value as any)}
              className="rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-all"
              style={{
                borderColor: formData.savingsPlan === opt.value ? 'rgb(var(--brand))' : 'rgb(var(--border))',
                background: formData.savingsPlan === opt.value ? 'rgb(var(--brand) / 0.06)' : 'rgb(var(--surface))',
                color: formData.savingsPlan === opt.value ? 'rgb(var(--brand))' : 'rgb(var(--ink-muted))',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly amount */}
      <div>
        <label htmlFor="monthlyAmount" className="mb-1.5 block text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>
          Monthly contribution (₦) <span className="text-xs font-normal" style={{ color: 'rgb(var(--ink-muted))' }}>optional</span>
        </label>
        <input
          id="monthlyAmount" name="monthlyAmount" type="number" min={0} step={500}
          value={formData.monthlyAmount}
          onChange={e => update('monthlyAmount', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, monthlyAmount: true }))}
          placeholder="e.g. 10000"
          className={`input-base ${errors.monthlyAmount ? 'input-error' : ''}`}
          aria-invalid={!!errors.monthlyAmount}
        />
        {errors.monthlyAmount && <p className="mt-1.5 text-xs" style={{ color: 'rgb(var(--danger))' }} role="alert">{errors.monthlyAmount}</p>}
      </div>

      {/* Info */}
      <div className="rounded-lg border px-4 py-3 text-xs" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--surface-2))', color: 'rgb(var(--ink-muted))' }}>
        New accounts use the Staff ID as the initial password for sign-in after approval.
      </div>

      {/* Submit */}
      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isPending ? 'Submitting…' : 'Register'}
      </button>
    </form>
  )
}
