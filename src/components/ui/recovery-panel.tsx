'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, WifiOff } from 'lucide-react'

export function RecoveryPanel({ reset, reference }: { reset: () => void; reference?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <section className="recovery-panel" aria-labelledby="recovery-title" role="alert">
      <span className="recovery-icon">
        <WifiOff size={28} aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-accent">Page unavailable</p>
      <h1 id="recovery-title">We could not load this page.</h1>
      <p>
        Please try again. We will show your figures once we can load them, rather than display an
        incorrect balance.
      </p>
      <div className="recovery-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.refresh()
              reset()
            })
          }
        >
          <RefreshCw size={18} className={pending ? 'animate-spin' : ''} aria-hidden="true" />
          {pending ? 'Trying again...' : 'Try again'}
        </button>
        <Link href="/" className="btn-ghost">
          <ArrowLeft size={18} aria-hidden="true" /> Back to home
        </Link>
      </div>
      <p className="recovery-note">
        If you were submitting a request or saving a change, check its status before submitting it
        again.
      </p>
      {reference && <p className="recovery-reference">Support reference: {reference}</p>}
    </section>
  )
}
