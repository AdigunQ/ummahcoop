import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect('/dashboard')

  return (
    <div className="flex min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      {/* Left panel — branding */}
      <div className="hidden w-[42%] flex-col justify-between p-10 lg:flex"
        style={{ background: 'rgb(var(--surface-2))' }}>
        <div className="flex items-center gap-3">
          <UmmahLogo markClassName="h-10 w-10" textClassName="text-[rgb(var(--ink))]" compactText />
        </div>
        <div className="animate-slideUp">
          <h2 className="text-[2rem] font-light leading-[1.15] tracking-[-0.02em]" style={{ color: 'rgb(var(--ink))' }}>
            Your cooperative,
            <br />
            <span style={{ color: 'rgb(var(--ink-muted))' }}>in one place.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: 'rgb(var(--ink-muted))' }}>
            Track thrift savings, manage contributions, request loans, and stay connected with your cooperative.
          </p>
        </div>
        <p className="text-xs" style={{ color: 'rgb(var(--ink-muted))' }}>
          &copy; {new Date().getFullYear()} Ummah Coop
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] animate-fadeIn space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center justify-between lg:hidden">
            <UmmahLogo markClassName="h-9 w-9" textClassName="text-[rgb(var(--ink))]" compactText />
            <ThemeToggle />
          </div>

          <div>
            <h1 className="text-3xl font-light tracking-[-0.02em]" style={{ color: 'rgb(var(--ink))' }}>
              Welcome back.<br />
              <span style={{ color: 'rgb(var(--ink-muted))' }}>Sign in to your account</span>
            </h1>
          </div>

          <LoginForm />

          <p className="text-center text-sm" style={{ color: 'rgb(var(--ink-muted))' }}>
            Not a member yet?{' '}
            <Link href="/register" className="font-medium transition-colors hover:underline"
              style={{ color: 'rgb(var(--brand))' }}>
              Join as member
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
