import Link from 'next/link'
import { ArrowRight, HandCoins, PiggyBank, ShieldCheck, Wallet } from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { ThemeToggle } from '@/components/theme-toggle'

const features = [
  { title: 'Thrift Savings', description: 'A regular monthly contribution that steadily grows your nest.', icon: PiggyBank },
  { title: 'Special Savings', description: 'A separate target bucket for milestones, projects, and goals.', icon: Wallet },
  { title: 'Member Loans', description: 'Borrow against your own savings at clear, fixed terms.', icon: HandCoins },
]

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'rgb(var(--bg))', color: 'rgb(var(--ink))' }}>
      {/* Ambient mesh */}
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.28] dark:opacity-[0.10]" />
      <div className="pointer-events-none absolute inset-0 glow-radial" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(var(--brand)/0.25)] to-transparent" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10">
        <UmmahLogo markClassName="h-9 w-9" textClassName="text-[rgb(var(--ink))]" compactText />
        <div className="flex items-center gap-3">
          <ThemeToggle data-testid="theme-toggle" />
          <Link href="/login" data-testid="header-sign-in-link" aria-label="Member login"
            className="hidden text-sm font-medium transition-colors sm:inline-flex"
            style={{ color: 'rgb(var(--ink-muted))' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgb(var(--ink))')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgb(var(--ink-muted))')}
          >
            Member login
          </Link>
          <Link href="/register" data-testid="header-register-button" className="btn-primary !py-2 !px-4 text-xs">
            Join as member <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-12 lg:px-10 lg:pt-24">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Left */}
          <div className="animate-slideUp">
            <div className="pill mb-6" style={{ background: 'rgb(var(--surface-2))', color: 'rgb(var(--ink-muted))' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgb(var(--success))' }} />
              Private cooperative &middot; 2026
            </div>

            <h1 className="text-[2.5rem] font-light leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]"
              style={{ color: 'rgb(var(--ink))' }}>
              Save together,
              <br />
              <span style={{ color: 'rgb(var(--ink-muted))' }}>grow together.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed sm:text-lg" style={{ color: 'rgb(var(--ink-muted))' }}>
              A private cooperative platform for FAAN staff. Thrift savings, special contributions, and member loans — all from one quiet dashboard.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/register" data-testid="hero-register-button" className="btn-primary">
                Register as member <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" data-testid="hero-sign-in-button" className="btn-ghost">Member login</Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              {[{ icon: ShieldCheck, label: 'Admin-reviewed' }, { icon: ShieldCheck, label: 'Member-only' }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs" style={{ color: 'rgb(var(--ink-muted))' }}>
                  <Icon className="h-4 w-4" style={{ color: 'rgb(var(--brand))' }} />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — preview card */}
          <div className="relative animate-scaleIn">
            <div className="card relative overflow-hidden p-6">
              <div className="absolute inset-0 bg-gradient-to-br opacity-[0.04]" style={{ background: `linear-gradient(135deg, rgb(var(--brand)), transparent)` }} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow">Account snapshot</span>
                  <span className="pill" style={{ background: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgb(var(--success))' }} />Active
                  </span>
                </div>
                <div className="mt-6">
                  <p className="text-sm" style={{ color: 'rgb(var(--ink-muted))' }}>Total balance</p>
                  <p className="mt-1 text-4xl font-light tracking-tight" style={{ color: 'rgb(var(--ink))' }}>&#8358;1,284,500</p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-4" style={{ background: 'rgb(var(--surface-2))', borderColor: 'rgb(var(--border))' }}>
                    <span className="label-eyebrow">Thrift</span>
                    <p className="mt-2 text-lg font-medium" style={{ color: 'rgb(var(--ink))' }}>&#8358;820,000</p>
                  </div>
                  <div className="rounded-xl border p-4" style={{ background: 'rgb(var(--surface-2))', borderColor: 'rgb(var(--border))' }}>
                    <span className="label-eyebrow">Special</span>
                    <p className="mt-2 text-lg font-medium" style={{ color: 'rgb(var(--ink))' }}>&#8358;464,500</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    { name: 'Monthly contribution', amount: '+ ₦25,000', tone: 'rgb(var(--success))' },
                    { name: 'Special saving', amount: '+ ₦10,000', tone: 'rgb(var(--success))' },
                  ].map(row => (
                    <div key={row.name} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'rgb(var(--ink-muted))' }}>{row.name}</span>
                      <span className="font-medium" style={{ color: row.tone }}>{row.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid gap-4 sm:grid-cols-3">
          {features.map(f => (
            <article key={f.title} className="card card-hover p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'rgb(var(--brand) / 0.08)', color: 'rgb(var(--brand))' }}>
                <f.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-base font-medium tracking-tight" style={{ color: 'rgb(var(--ink))' }}>{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'rgb(var(--ink-muted))' }}>{f.description}</p>
            </article>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t pt-8" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs" style={{ color: 'rgb(var(--ink-muted))' }}>
              &copy; {new Date().getFullYear()} Ummah Multipurpose Cooperative. Members-only portal.
            </p>
            <p className="text-xs" style={{ color: 'rgb(var(--ink-muted))' }}>For internal use</p>
          </div>
        </footer>
      </section>
    </div>
  )
}
