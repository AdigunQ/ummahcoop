'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { ThemeToggle } from '@/components/theme-toggle'

function getLoginErrorMessage(error?: string | null) {
  if (!error || error === 'undefined') {
    return 'Login failed. Please check your Staff ID or email and password.'
  }

  const normalized = error.trim()

  if (normalized === 'CredentialsSignin') {
    return 'Invalid Staff ID, email or password.'
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
    setIdentifierError(null)
    setPasswordError(null)

    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier) {
      setIdentifierError('Enter your Staff ID or email address.')
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
      window.location.assign(result.url || '/dashboard')
    } catch (error) {
      toast.error('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.35] dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 glow-radial" />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" data-testid="login-back-home">
          <UmmahLogo
            markClassName="h-9 w-9"
            textClassName="text-foreground"
            compactText
          />
        </Link>
        <ThemeToggle data-testid="login-theme-toggle" />
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl gap-12 px-6 pb-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-10">
        {/* Left — brand panel */}
        <div className="hidden lg:block">
          <div
            className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Secure access
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-[-0.02em] leading-[1.05]">
            Welcome back.
            <br />
            <span className="text-muted-foreground">Continue managing your cooperative.</span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
            Sign in to view your thrift savings, special contributions, loan history,
            and submit new requests — all from one quiet dashboard.
          </p>

          <div className="mt-12 space-y-4">
            {[
              { label: 'Encrypted credentials', detail: 'bcrypt hashed & session-secured' },
              { label: 'Member-only routes', detail: 'admin approval required to access' },
              { label: 'Audit-ready records', detail: 'every transaction is logged' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form card */}
        <div className="w-full">
          <div className="card mx-auto w-full max-w-md p-7 sm:p-9">
            <div className="mb-7">
              <p className="label-eyebrow">Member portal</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to your account</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Use your Staff ID or registered email to continue.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="identifier" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff ID or email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="identifier"
                    data-testid="login-identifier-input"
                    type="text"
                    name="identifier"
                    placeholder="e.g. OPS-1042 or staff@faan.gov.ng"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    spellCheck={false}
                    required
                    className="input-base pl-10"
                  />
                </div>
                {identifierError && (
                  <p className="mt-1.5 text-xs font-medium text-rose-500" data-testid="login-identifier-error">{identifierError}</p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                    className="input-base pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    data-testid="login-password-toggle"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="mt-1.5 text-xs font-medium text-rose-500" data-testid="login-password-error">{passwordError}</p>
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
            </form>

            <div className="mt-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to the cooperative?{' '}
              <Link
                href="/register"
                data-testid="login-register-link"
                className="font-semibold text-accent transition-colors hover:underline"
              >
                Open an account
              </Link>
            </p>
          </div>

          <p className="mx-auto mt-5 max-w-md text-center text-[11px] leading-5 text-muted-foreground">
            By continuing you confirm you are an authorized FAAN staff member.
          </p>
        </div>
      </section>
    </main>
  )
}
