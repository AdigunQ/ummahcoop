'use client'

import { RecoveryPanel } from '@/components/ui/recovery-panel'

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="recovery-page">
      <RecoveryPanel reset={reset} reference={error.digest} />
    </main>
  )
}
