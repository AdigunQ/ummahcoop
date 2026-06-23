'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ staffId: '', password: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const staffIdError = touched.staffId && !formData.staffId.trim() ? 'Staff ID or email is required'
    : formData.staffId && formData.staffId.trim().length < 3 ? 'Too short' : ''
  const passwordError = touched.password && !formData.password ? 'Password is required' : ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ staffId: true, password: true })
    if (staffIdError || passwordError) return

    startTransition(async () => {
      setError('')
      const result = await signIn('credentials', {
        staffId: formData.staffId.trim(),
        password: formData.password,
        redirect: false,
      })
      if (result?.error) {
        setError('Invalid Staff ID, email or password.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    })
  }

  const update = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Error banner */}
      {error && (
        <div className="animate-scaleIn rounded-lg border px-4 py-3 text-sm" role="alert"
          style={{ background: 'rgb(var(--danger) / 0.06)', borderColor: 'rgb(var(--danger) / 0.2)', color: 'rgb(var(--danger))' }}>
          {error}
        </div>
      )}

      {/* Staff ID / Email */}
      <div>
        <label htmlFor="staffId" className="mb-1.5 block text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>
          Staff ID or email
        </label>
        <input
          id="staffId"
          name="staffId"
          type="text"
          autoComplete="username"
          autoFocus
          required
          value={formData.staffId}
          onChange={e => update('staffId', e.target.value)}
          onBlur={() => setTouched(prev => ({ ...prev, staffId: true }))}
          placeholder="e.g. 009709 or name@faan.gov.ng"
          className={`input-base ${staffIdError ? 'input-error' : ''}`}
          aria-invalid={!!staffIdError}
          aria-describedby={staffIdError ? 'staffId-error' : undefined}
        />
        {staffIdError && <p id="staffId-error" className="mt-1.5 text-xs" style={{ color: 'rgb(var(--danger))' }} role="alert">{staffIdError}</p>}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={e => update('password', e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
            placeholder="Your password"
            className={`input-base pr-10 ${passwordError ? 'input-error' : ''}`}
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? 'password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:bg-[rgb(var(--surface-2))]"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" style={{ color: 'rgb(var(--ink-muted))' }} /> : <Eye className="h-4 w-4" style={{ color: 'rgb(var(--ink-muted))' }} />}
          </button>
        </div>
        {passwordError && <p id="password-error" className="mt-1.5 text-xs" style={{ color: 'rgb(var(--danger))' }} role="alert">{passwordError}</p>}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
