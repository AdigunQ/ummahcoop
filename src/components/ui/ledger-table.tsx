'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, SearchX, X } from 'lucide-react'
import { EmptyState } from './overview'

type LedgerRow = { key: string; cells: string[] }

export function LedgerTable({
  columns,
  rows,
  title,
  description,
}: {
  columns: string[]
  rows: LedgerRow[]
  title: string
  description: string
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const size = 25
  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        row.cells
          .slice(0, 2)
          .some((value) => value.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [rows, query]
  )
  const lastPage = Math.max(0, Math.ceil(filtered.length / size) - 1)
  const currentPage = Math.min(page, lastPage)
  const visible = filtered.slice(currentPage * size, (currentPage + 1) * size)
  return (
    <section className="card member-ledger min-w-0 overflow-hidden">
      <div className="flex flex-col justify-between gap-4 border-b px-6 py-5 lg:flex-row lg:items-center">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="relative w-full lg:max-w-[290px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Search member data"
            placeholder="Search name or Staff ID"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            className="input-base !min-h-10 !py-2 pl-10 pr-8"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setPage(0)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div
        className="max-h-[620px] overflow-auto"
        tabIndex={0}
        role="region"
        aria-label="Member ledger, scroll to see all columns"
      >
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col}
                  className={`text-left ${i === 0 ? 'sticky left-0 z-30 w-[125px] min-w-[125px]' : i === 1 ? 'sticky left-[125px] z-30 min-w-[210px] shadow-[1px_0_0_rgb(var(--border))]' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key} className="group">
                {row.cells.map((cell, i) => (
                  <td
                    key={columns[i]}
                    className={`${i === 0 ? 'sticky left-0 z-10 bg-surface font-mono text-xs group-hover:bg-surface-2' : i === 1 ? 'sticky left-[125px] z-10 bg-surface font-medium shadow-[1px_0_0_rgb(var(--border))] group-hover:bg-surface-2' : 'whitespace-nowrap'} ${i === columns.length - 1 ? 'font-semibold text-accent' : ''}`}
                  >
                    {cell || <span className="text-muted-foreground">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title={query ? 'No matching members' : 'No records for this month'}
            description={
              query
                ? 'Try a different name or Staff ID.'
                : 'Choose another month or import a workbook to get started.'
            }
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
        <p className="text-xs text-muted-foreground" role="status">
          {filtered.length
            ? `${currentPage * size + 1}-${Math.min((currentPage + 1) * size, filtered.length)}`
            : '0'}{' '}
          of {filtered.length} records{query ? ' matching your search' : ''}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="Previous page"
            className="rounded-lg border p-2 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage + 1} of {lastPage + 1}
          </span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === lastPage}
            aria-label="Next page"
            className="rounded-lg border p-2 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
