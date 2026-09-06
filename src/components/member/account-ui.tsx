'use client'

import { paginationState } from '@/components/ui/pagination-state'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { StatementDownload } from './statement-download'

export function StatementLink() {
  return <StatementDownload />
}

export function Amount({ value, unknown = false }: { value: number; unknown?: boolean }) {
  return <span className="account-money">{unknown ? 'Not recorded' : formatCurrency(value)}</span>
}

export function BalanceStrip({
  collected,
  paid,
  outstanding,
  label = 'Amount received',
  outstandingLabel = 'Outstanding',
  note = 'Includes recorded monthly deductions.',
  period,
}: {
  collected: number
  paid: number
  outstanding: number
  label?: string
  outstandingLabel?: string
  note?: string
  period?: string | null
}) {
  const unknown = collected <= 0 && (paid > 0 || outstanding > 0)
  if (collected === 0 && paid === 0 && outstanding === 0) {
    return (
      <section className="account-balance account-balance-empty" aria-label="Account balances">
        <span>No {label.toLowerCase()} yet</span>
        <strong>
          <Amount value={0} /> <span>outstanding</span>
        </strong>
      </section>
    )
  }
  return (
    <section className="account-balance" aria-label="Account balances">
      <div className="account-balance-grid">
        <div>
          <span>{label}</span>
          <strong>
            <Amount value={collected} unknown={unknown} />
          </strong>
        </div>
        <div>
          <span>Repaid so far</span>
          <strong>
            <Amount value={paid} />
          </strong>
        </div>
        <div>
          <span>{outstandingLabel}</span>
          <strong>
            <Amount value={outstanding} unknown={unknown && outstanding <= 0} />
          </strong>
        </div>
      </div>
      <p className="account-balance-note">
        {unknown
          ? 'The original amount has not been recorded. Contact your admin to confirm the balance.'
          : note}
        {period && ` Ledger through ${monthLabel(period)}.`}
      </p>
    </section>
  )
}

export function monthLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/)
  if (!match) return value
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function shortDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  })
}

export function readable(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (first) => first.toUpperCase())
}

export function FilterTabs({
  options,
  value,
  onChange,
  label = 'Filter records',
}: {
  options: { value: string; label: string; count?: number }[]
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  return (
    <div className="account-tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span>{option.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function AccountEmpty({
  title,
  text,
  action,
}: {
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="account-empty">
      <span className="account-empty-mark" aria-hidden="true">
        /
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function DetailRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="account-details">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value ?? 'Not recorded'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  busy = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const focused = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      focused?.focus()
    }
  }, [open])
  return (
    <dialog
      ref={ref}
      className="account-drawer"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose()
        }
      }}
    >
      <header>
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="account-icon-button"
          aria-label="Close details"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {open && <div className="account-drawer-body">{children}</div>}
    </dialog>
  )
}

export function Pagination({
  page,
  total,
  size,
  onChange,
}: {
  page: number
  total: number
  size: number
  onChange: (page: number) => void
}) {
  const { page: currentPage, pages, start, end } = paginationState(page, total, size)
  return (
    <footer className="account-pagination">
      <span>{total ? `${start + 1}-${end} of ${total}` : '0 records'}</span>
      <div>
        <button
          type="button"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onChange(currentPage - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {currentPage} / {pages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={currentPage >= pages}
          onClick={() => onChange(currentPage + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </footer>
  )
}
