import Link from 'next/link'
import {
  ArrowRight,
  HandCoins,
  PiggyBank,
  ShieldCheck,
  Wallet,
  LineChart,
  Lock,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const features = [
  {
    title: 'Thrift Savings',
    description: 'A consistent monthly contribution that builds your core savings.',
    icon: PiggyBank,
  },
  {
    title: 'Special Savings',
    description: 'A separate, goal-oriented bucket for milestones and projects.',
    icon: Wallet,
  },
  {
    title: 'Member Loans',
    description: 'Borrow against your savings with transparent, fixed terms.',
    icon: HandCoins,
  },
]

const trustPoints = [
  { icon: ShieldCheck, label: 'Admin-reviewed' },
  { icon: Lock, label: 'Member-only access' },
  { icon: LineChart, label: 'Monthly reporting' },
]

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-[0.35] dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute inset-0 glow-radial" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/70 text-accent-foreground shadow-sm">
            <span className="text-sm font-bold tracking-tight">U</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Ummah Cooperative</p>
            <p className="text-[11px] text-muted-foreground">FAAN Staff Multipurpose</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle data-testid="theme-toggle" />
          <Link
            href="/login"
            data-testid="header-sign-in-link"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            data-testid="header-register-button"
            className="btn-primary !py-2 !px-4 text-xs"
          >
            Open account
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-10 lg:px-10 lg:pt-20">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Member portal · 2026
            </div>

            <h1 className="mt-6 max-w-2xl text-[2.75rem] font-semibold tracking-[-0.02em] text-foreground sm:text-5xl lg:text-[3.75rem] lg:leading-[1.05]">
              Savings and loans,
              <br />
              <span className="text-muted-foreground">handled the modern way.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A focused cooperative platform for FAAN staff — manage thrift savings,
              track special contributions, and request member loans from one calm dashboard.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                data-testid="hero-register-button"
                className="btn-primary"
              >
                Register as member
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                data-testid="hero-sign-in-button"
                className="btn-ghost"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              {trustPoints.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-4 w-4 text-accent" />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right side mock card */}
          <div className="relative">
            <div className="card relative overflow-hidden p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.06] via-transparent to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="label-eyebrow">Account snapshot</p>
                  <span className="pill bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>

                <div className="mt-6">
                  <p className="text-sm text-muted-foreground">Total balance</p>
                  <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
                    ₦1,284,500
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Thrift</p>
                    <p className="mt-2 text-lg font-semibold">₦820,000</p>
                  </div>
                  <div className="rounded-xl border bg-surface-2 p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Special</p>
                    <p className="mt-2 text-lg font-semibold">₦464,500</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {[
                    { name: 'Monthly contribution', amount: '+ ₦25,000', tone: 'text-emerald-600 dark:text-emerald-400' },
                    { name: 'Special saving', amount: '+ ₦10,000', tone: 'text-emerald-600 dark:text-emerald-400' },
                    { name: 'Loan repayment', amount: '− ₦18,750', tone: 'text-foreground' },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.name}</span>
                      <span className={`font-semibold ${row.tone}`}>{row.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating accent card */}
            <div
              className="absolute -bottom-6 -left-6 hidden w-56 rounded-2xl border bg-surface p-4 shadow-soft sm:block dark:shadow-soft-dark"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">YTD growth</p>
                  <p className="text-sm font-semibold">+ 18.4%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="card card-hover p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <feature.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-base font-semibold tracking-tight text-foreground">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t pt-8" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} FAAN Staff Ummah Multipurpose Cooperative.
            </p>
            <p className="text-xs text-muted-foreground">
              Members-only portal · For internal use
            </p>
          </div>
        </footer>
      </section>
    </main>
  )
}
