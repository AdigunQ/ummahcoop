import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="label-eyebrow mb-2 text-accent">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function StatCard({
  label,
  value,
  note,
  icon,
  tone = 'green',
}: {
  label: string
  value: string
  note?: string
  icon: ReactNode
  tone?: 'green' | 'amber' | 'blue' | 'neutral' | 'red'
}) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={`icon-tile tone-${tone} !h-9 !w-9`}>{icon}</span>
      </div>
      <p className="metric-value">{value}</p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tone = ['APPROVED', 'ACTIVE', 'COMPLETED', 'SUCCESS', 'PAID'].includes(status)
    ? 'green'
    : ['PENDING', 'PROCESSING', 'GENERATED'].includes(status)
      ? 'amber'
      : ['REJECTED', 'FAILED', 'CLOSED', 'SUSPENDED'].includes(status)
        ? 'red'
        : 'neutral'
  return (
    <span className={cn('status-badge', `tone-${tone}`)}>
      <span className="h-1 w-1 rounded-full bg-current" />
      {status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ')}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="icon-tile mb-4 bg-surface-2 text-muted-foreground">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
