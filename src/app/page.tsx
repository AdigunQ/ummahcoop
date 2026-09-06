import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  HandCoins,
  Leaf,
  PiggyBank,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="public-wrap">
        <div className="public-header">
          <Link href="/" aria-label="Ummah Coop home">
            <UmmahLogo compactText />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#savings" className="hover:text-accent">
              Made for your future
            </a>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> A cooperative, together
            </span>
          </div>
          <nav className="flex items-center gap-3 sm:gap-5" aria-label="Main navigation">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              href="/login"
              data-testid="header-sign-in-link"
              className="text-sm font-medium hover:text-accent"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              data-testid="header-register-button"
              className="btn-primary !px-4 !py-2"
            >
              Register <ArrowUpRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>
      <section
        id="main-content"
        className="public-wrap grid items-center gap-12 py-12 lg:min-h-[560px] lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-14"
      >
        <div className="reveal">
          <p className="mb-7 flex items-center gap-2 text-xs font-semibold normal-case tracking-normal text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Small steps. Shared
            possibilities.
          </p>
          <h1 className="editorial-title max-w-xl text-[3rem] sm:text-[3.75rem] lg:text-[4.25rem]">
            A little today.
            <br />
            <em className="font-normal text-accent">More tomorrow.</em>
          </h1>
          <p className="mt-6 max-w-[380px] text-sm leading-7 text-muted-foreground">
            Make room for the things that matter. Build your savings, plan ahead, and find support
            in a community that grows with you.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/register" data-testid="hero-register-button" className="btn-primary !px-6">
              Start saving with us <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              data-testid="hero-sign-in-button"
              className="inline-flex items-center gap-2 text-sm font-medium hover:text-accent"
            >
              Already a member? <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-accent" /> Your savings. Your progress. All in one
            place.
          </p>
        </div>
        <div
          className="reveal reveal-delay relative mx-auto w-full max-w-[490px] pb-6 pt-5"
          aria-label="Illustration of the member savings experience"
        >
          <div className="absolute -right-3 -top-2 h-[370px] w-[370px] max-w-full rounded-full border border-accent/10 bg-[radial-gradient(ellipse_at_center,_rgb(var(--accent)/.06),_transparent_70%)]" />
          <div className="absolute inset-x-7 top-10 h-[345px] rotate-[-7deg] rounded-[24px] border border-accent/15 bg-surface-2" />
          <div className="balance-card relative px-7 pb-7 pt-6 sm:px-9">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#dfeabb]">Your future, taking shape</p>
              <Leaf className="h-5 w-5 text-[#dfeabb]" />
            </div>
            <div className="my-8">
              <p className="text-xs text-white/85">A place for every goal</p>
              <p className="mt-3 font-display text-[2.25rem] leading-snug tracking-normal">
                Good habits.
                <br />
                <em className="text-[#dfeabb]">Greater possibilities.</em>
              </p>
            </div>
            <div className="flex items-end gap-2 border-b border-white/15 pb-0" aria-hidden="true">
              {[23, 36, 29, 50, 44, 65, 70, 89, 100, 117, 128, 144].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[5px]"
                  style={{
                    height: height / 1.8,
                    background: i > 8 ? '#dfeabb' : `rgba(223,234,187,${0.1 + i * 0.025})`,
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-white/85">
              <span>A little consistency goes a long way</span>
              <ArrowUpRight className="h-4 w-4 text-[#dfeabb]" />
            </div>
          </div>
          <div className="relative ml-8 mt-[-10px] flex items-center gap-4 rounded-2xl border bg-surface px-5 py-4 shadow-soft sm:ml-14">
            <span className="icon-tile tone-green">
              <Check className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">One community. Your own goals.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Thrift, special savings, and member support.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section id="savings" className="public-wrap">
        <div className="grid border-y md:grid-cols-3">
          {[
            {
              icon: PiggyBank,
              title: 'A steady saving habit',
              text: 'Build your thrift savings, month by month.',
              number: '01',
            },
            {
              icon: Wallet,
              title: 'Something to look forward to',
              text: 'Set money aside with special savings.',
              number: '02',
            },
            {
              icon: HandCoins,
              title: 'Support for your next step',
              text: 'Request a loan when you are eligible.',
              number: '03',
            },
          ].map(({ icon: Icon, title, text, number }) => (
            <article
              key={number}
              className="flex gap-4 py-6 md:px-5 md:first:pl-0 md:[&:not(:last-child)]:border-r"
            >
              <Icon className="mt-1 h-5 w-5 shrink-0 text-accent" />
              <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <footer className="public-wrap flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Ummah Coop. Growing together.</p>
        <span>Save today. Enjoy tomorrow.</span>
      </footer>
    </main>
  )
}
