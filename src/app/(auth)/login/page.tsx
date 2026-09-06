'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { ArrowRight, Eye, EyeOff, Hash, Loader2, Lock } from 'lucide-react'
import { AuthShell } from '@/components/public/auth-shell'

function getLoginErrorMessage(error?: string | null) {
  if (!error || error === 'undefined') {
    return 'Login failed. Please check your Staff ID and password.'
  }

  const normalized = error.trim()

  if (normalized === 'CredentialsSignin') {
    return 'Invalid Staff ID or password.'
  }

  return normalized
}

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [identifierError, setIdentifierError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawError = params.get('error')
    if (!rawError) return

    toast.error(getLoginErrorMessage(rawError))

    params.delete('error')
    const nextQuery = params.toString()
    router.replace(nextQuery ? `/login?${nextQuery}` : '/login')
  }, [router])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading) return
    setIdentifierError(null)
    setPasswordError(null)

    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier) {
      setIdentifierError('Enter your Staff ID.')
      return
    }

    if (!password.trim()) {
      setPasswordError('Password is required.')
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        identifier: trimmedIdentifier,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (!result) {
        toast.error('Login service is unavailable. Please refresh and try again.')
        return
      }

      if (result.error || result.ok === false) {
        toast.error(getLoginErrorMessage(result?.error))
        return
      }

      toast.success('Welcome back')
      window.location.assign('/dashboard')
    } catch (error) {
      toast.error('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="auth-form-heading">
        <h1>Welcome back.</h1>
        <p>Sign in with your Staff ID and password.</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={isLoading} className="space-y-5">
          <div>
            <label htmlFor="identifier" className="mb-2 block text-sm font-medium text-foreground">
              Staff ID
            </label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="identifier"
                data-testid="login-identifier-input"
                type="text"
                name="identifier"
                placeholder="e.g. 009709"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                required
                aria-invalid={!!identifierError}
                aria-describedby={identifierError ? 'identifier-error' : undefined}
                className="input-base pl-10"
              />
            </div>
            {identifierError && (
              <p
                className="mt-1.5 text-xs font-medium text-rose-500"
                data-testid="login-identifier-error"
                id="identifier-error"
                role="alert"
              >
                {identifierError}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                data-testid="login-password-input"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className="input-base pl-10 pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                data-testid="login-password-toggle"
                className="auth-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordError && (
              <p
                className="mt-1.5 text-xs font-medium text-rose-500"
                data-testid="login-password-error"
                id="password-error"
                role="alert"
              >
                {passwordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            data-testid="login-submit-button"
            disabled={isLoading}
            className="btn-primary w-full !py-3.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </fieldset>
      </form>

      <p className="auth-form-alternate">
        New to Ummah Coop?{' '}
        <Link
          href="/register"
          data-testid="login-register-link"
          className="font-semibold text-accent hover:underline"
        >
          Register <ArrowRight className="inline h-4 w-4" />
        </Link>
      </p>
    </AuthShell>
  )
}
