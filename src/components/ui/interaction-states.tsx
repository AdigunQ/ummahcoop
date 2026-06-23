import { AlertTriangle, Inbox } from 'lucide-react'

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg p-4" style={{ background: 'rgb(var(--surface-2))' }}>
          <div className="h-4 flex-1 rounded" style={{ background: 'rgb(var(--border))' }} />
          <div className="h-4 w-20 rounded" style={{ background: 'rgb(var(--border))' }} />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', description, action }: {
  title?: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgb(var(--surface-2))' }}>
        <Inbox className="h-6 w-6" style={{ color: 'rgb(var(--ink-muted))' }} />
      </div>
      <h3 className="text-base font-medium" style={{ color: 'rgb(var(--ink))' }}>{title}</h3>
      {description && <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ink-muted))' }}>{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ message = 'Something went wrong', onRetry }: {
  message?: string; onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgb(var(--danger) / 0.08)' }}>
        <AlertTriangle className="h-6 w-6" style={{ color: 'rgb(var(--danger))' }} />
      </div>
      <h3 className="text-base font-medium" style={{ color: 'rgb(var(--ink))' }}>Error</h3>
      <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ink-muted))' }}>{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-secondary mt-6">Try again</button>}
    </div>
  )
}
