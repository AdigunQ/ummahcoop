'use client'

import { useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Pagination } from '@/components/member/account-ui'
import { SmartSelect } from '@/components/ui/smart-select'

export type AdminTableRow = {
  key: string
  cells: ReactNode[]
  searchText: string
  category?: string
}
export function AdminDataTable({
  columns,
  rows,
  title = 'Records',
  note,
  categories = [],
}: {
  columns: string[]
  rows: AdminTableRow[]
  title?: string
  note?: string
  categories?: { value: string; label: string }[]
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [page, setPage] = useState(1)
  const filtered = rows.filter(
    (row) =>
      (category === 'all' || row.category === category) &&
      row.searchText.toLowerCase().includes(query.trim().toLowerCase())
  )
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)))
  return (
    <section className="admin-panel">
      <header className="admin-panel-heading">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        <span className="admin-tag">{rows.length} records</span>
      </header>
      <div className="admin-table-toolbar">
        <label className="admin-search">
          <Search size={16} />
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder="Search name, Staff ID or reference"
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
        {categories.length > 0 && (
          <SmartSelect
            className="admin-filter-select"
            label="Filter records"
            value={category}
            onChange={(value) => {
              setCategory(value)
              setPage(1)
            }}
            options={[{ value: 'all', label: 'All records' }, ...categories]}
            searchable={false}
          />
        )}
        <span>{filtered.length} matching records</span>
      </div>
      <div className="admin-table-scroll" tabIndex={0} aria-label={title}>
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * 20, current * 20).map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="admin-empty">No matching records.</p>}
      </div>
      <Pagination page={current} total={filtered.length} size={20} onChange={setPage} />
    </section>
  )
}
