'use client'

import { Children, isValidElement, useState, type ReactNode } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import { Drawer, Pagination } from '@/components/member/account-ui'
import { StatusBadge } from '@/components/ui/overview'
import { useFormStatus } from 'react-dom'

export function AdminCollection({
  children,
  label = 'Search name or Staff ID',
}: {
  children: ReactNode
  label?: string
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const records = Children.toArray(children)
  const filtered = records.filter(
    (child) =>
      isValidElement<{ searchText?: string }>(child) &&
      (child.props.searchText || '').toLowerCase().includes(query.trim().toLowerCase())
  )
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)))
  return (
    <div className="admin-collection">
      <div className="admin-collection-toolbar">
        <label className="admin-search">
          <Search size={16} />
          <input
            aria-label={label}
            placeholder={label}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setPage(1)
              }}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <span>{filtered.length} records</span>
      </div>
      <div className="admin-collection-list">
        {filtered.slice((currentPage - 1) * 8, currentPage * 8)}
        {!filtered.length && (
          <p className="admin-empty">No matching records. Try another name or Staff ID.</p>
        )}
      </div>
      {filtered.length > 8 && (
        <Pagination page={currentPage} total={filtered.length} size={8} onChange={setPage} />
      )}
    </div>
  )
}

export function AdminReviewItem({
  heading,
  meta,
  status,
  amount,
  children,
}: {
  heading: string
  meta?: string
  status?: string
  amount?: string
  searchText?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="admin-review-row" onClick={() => setOpen(true)}>
        <span className="admin-avatar">
          {heading
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join('')}
        </span>
        <span className="admin-review-identity">
          <strong>{heading}</strong>
          {meta && <small>{meta}</small>}
        </span>
        <span className="admin-review-amount">
          {amount && <strong>{amount}</strong>}
          {status && <StatusBadge status={status} />}
        </span>
        <span className="admin-review-open">
          Review
          <ChevronRight size={16} />
        </span>
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={heading} subtitle={meta}>
        <div className="admin-review-detail">{children}</div>
      </Drawer>
    </>
  )
}

export function AdminSubmit({
  children,
  pendingLabel = 'Saving…',
  className = 'btn-primary',
  disabled = false,
  ...rest
}: {
  children: ReactNode
  pendingLabel?: string
  className?: string
  disabled?: boolean
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" {...rest} disabled={disabled || pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  )
}
