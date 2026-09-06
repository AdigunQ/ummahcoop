import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, LockKeyhole, PiggyBank, ShieldCheck, Wallet } from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { ThemeToggle } from '@/components/theme-toggle'

export function AuthShell({
  children,
  registration = false,
}: {
  children: ReactNode
  registration?: boolean
}) {
  return (
    <main className="auth-portal" data-page={registration ? 'register' : 'login'}>
      <a href="#auth-form" className="skip-link">
        Skip to form
      </a>
      <header className="auth-portal-header">
        <Link href="/" aria-label="Ummah Coop home">
          <UmmahLogo compactText />
        </Link>
        <div>
          <Link
            href="/"
            className="auth-home-link"
            aria-label="Back to home"
            data-testid="login-back-home"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Back to home</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="auth-portal-layout">
        <aside className="auth-story">
          <div className="auth-story-copy">
            <p className="auth-story-label">
              <span /> Together, we grow.
            </p>
            <h2>
              {registration ? 'A little today.' : 'Your hard work.'}
              <br />
              <span>{registration ? 'A stronger tomorrow.' : 'Your next chapter.'}</span>
            </h2>
            <p className="auth-story-description">
              {registration
                ? 'Build a savings habit that makes room for the things that matter.'
                : 'Keep your savings, repayments and plans in one familiar place.'}
            </p>
          </div>
          <div className="auth-account-visual" aria-label="Ummah Coop savings account illustration">
            <div className="auth-visual-orbit" aria-hidden="true" />
            <div className="auth-member-pass">
              <div className="auth-pass-top">
                <UmmahLogo
                  showText={false}
                  markClassName="!text-[#dce8b6] [&_path]:!stroke-[#244b39]"
                />
                <span>
                  Your cooperative.
                  <br />
                  <strong>Your progress.</strong>
                </span>
                <ArrowUpRight size={25} aria-hidden="true" />
              </div>
              <p className="auth-pass-title">
                Made for your
                <br />
                everyday ambitions.
              </p>
              <div className="auth-pass-plans">
                <span>
                  <PiggyBank size={21} aria-hidden="true" /> Thrift savings
                </span>
                <span>
                  <Wallet size={21} aria-hidden="true" /> Special savings
                </span>
              </div>
              <div className="auth-pass-rule" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="auth-visual-caption">
              <span>
                <ShieldCheck size={23} aria-hidden="true" />
              </span>
              <div>
                <strong>One community. Shared progress.</strong>
                <p>That is the Ummah Coop way.</p>
              </div>
            </div>
          </div>
          <p className="auth-story-footnote">Savings for life, beyond the payslip.</p>
        </aside>
        <section
          id="auth-form"
          className="auth-entry"
          aria-label={registration ? 'Member registration' : 'Member sign in'}
        >
          <div className="auth-entry-label">
            <span>
              <LockKeyhole size={18} aria-hidden="true" />{' '}
              {registration ? 'Membership application' : 'Member access'}
            </span>
            <span className="auth-entry-dot" aria-hidden="true" />
          </div>
          <div className="auth-entry-body">{children}</div>
        </section>
      </div>
      <footer className="auth-portal-footer">
        <span>Ummah Coop &copy; {new Date().getFullYear()}</span>
        <span>Your cooperative, always within reach.</span>
      </footer>
    </main>
  )
}
