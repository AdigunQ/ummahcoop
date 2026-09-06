import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="recovery-page">
      <section className="recovery-panel">
        <p className="text-sm font-semibold text-accent">Page not found</p>
        <h1>This page is not available.</h1>
        <p>The address may have changed. Return to the homepage to continue.</p>
        <Link href="/" className="btn-primary mt-6">
          <ArrowLeft size={18} aria-hidden="true" /> Back to home
        </Link>
      </section>
    </main>
  )
}
