'use client'

import { RecoveryPanel } from '@/components/ui/recovery-panel'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RecoveryPanel reset={reset} reference={error.digest} />
}
