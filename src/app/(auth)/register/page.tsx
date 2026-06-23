import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { RegisterForm } from './register-form'

export default async function RegisterPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect('/dashboard')

  return (
    <div className="flex min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      {/* Left panel */}
      <div className="hidden w-[42%] flex-col justify-between p-10 lg:flex"
        style={{ background: 'rgb(var(--surface-2))' }}>
        <div className="flex items-center gap-3">
          <UmmahLogo markClassName="h-10 w-10" textClassName="text-[rgb(var(--ink))]" compactText />
        </div>
        <div className="animate-slideUp">
          <h2 className="text-[2rem] font-light leading-[1.15] tracking-[-0.02em]" style={{ color: 'rgb(var(--ink))' }}>
            Join the<br />
            <span style={{ color: 'rgb(var(--ink-muted))' }}>cooperative.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: 'rgb(var(--ink-muted))' }}>
            Three fields. Submit. Your membership is reviewed by admin — you will be notified when approved.
          </p>
          <div className="mt-8 space-y-4">
            {[
              { title: 'Thrift Savings', desc: 'Track regular monthly savings.' },
              { title: 'Special Savings', desc: 'Keep an extra savings balance.' },
              { title: 'Loan Access', desc: 'Request funds after approval.' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'rgb(var(--brand))' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'rgb(var(--ink))' }}>{item.title}</p>
                  <p className="text-xs" style={{ color: 'rgb(var(--ink-muted))' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: 'rgb(var(--ink-muted))' }}>&copy; {new Date().getFullYear()} Ummah Coop</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] animate-fadeIn space-y-8">
          <div className="flex items-center justify-between lg:hidden">
            <UmmahLogo markClassName="h-9 w-9" textClassName="text-[rgb(var(--ink))]" compactText />
            <ThemeToggle />
          </div>

          <div>
            <h1 className="text-3xl font-light tracking-[-0.02em]" style={{ color: 'rgb(var(--ink))' }}>
              Register as member
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ink-muted))' }}>Staff ID, name, and phone — nothing more.</p>
          </div>

          <RegisterForm />

          <p className="text-center text-sm" style={{ color: 'rgb(var(--ink-muted))' }}>
            Already a member?{' '}
            <Link href="/login" className="font-medium transition-colors hover:underline" style={{ color: 'rgb(var(--brand))' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
