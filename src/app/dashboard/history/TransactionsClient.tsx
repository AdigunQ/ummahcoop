'use client'

import { paginationState } from '@/components/ui/pagination-state'

import { useMemo, useState } from 'react'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { PageHeading, StatusBadge } from '@/components/ui/overview'
import { SmartSelect } from '@/components/ui/smart-select'
import {
  AccountEmpty,
  Amount,
  DetailRows,
  Drawer,
  FilterTabs,
  Pagination,
  readable,
  shortDate,
  StatementLink,
  monthLabel,
} from '@/components/member/account-ui'

export type TransactionRecord = {
  id: string
  type: string
  amount: number
  status: string
  reference: string | null
  description: string | null
  date: string
  createdAt: string
  reviewedAt: string | null
}

export default function TransactionsClient({
  ledger,
  payments,
  counts,
}: {
  ledger: TransactionRecord[]
  payments: TransactionRecord[]
  counts: { ledger: number; payments: number }
}) {
  const [source, setSource] = useState('ledger')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [month, setMonth] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const records = source === 'ledger' ? ledger : payments
  const count = source === 'ledger' ? counts.ledger : counts.payments
  const selected = records.find((record) => record.id === selectedId)
  const types = useMemo(
    () => Array.from(new Set(records.map((record) => record.type))).sort(),
    [records]
  )
  const statuses = useMemo(
    () => Array.from(new Set(records.map((record) => record.status))).sort(),
    [records]
  )
  const months = useMemo(
    () =>
      Array.from(new Set(records.map((record) => record.date.slice(0, 7))))
        .sort()
        .reverse(),
    [records]
  )
  const filtered = records.filter(
    (record) =>
      (status === 'all' || record.status === status) &&
      (type === 'all' || record.type === type) &&
      (month === 'all' || record.date.startsWith(month)) &&
      `${readable(record.type)} ${record.reference || ''} ${record.description || ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  )
  const hasFilters = query !== '' || status !== 'all' || type !== 'all' || month !== 'all'
  function reset() {
    setQuery('')
    setStatus('all')
    setType('all')
    setMonth('all')
    setPage(1)
  }
  const pagination = paginationState(page, filtered.length, 12)

  return (
    <div className="account-page">
      <PageHeading
        title="Transactions"
        description="Find a payment. Check the details."
        actions={<StatementLink />}
      />
      <section className="account-panel transactions-panel">
        <div className="transactions-source">
          <FilterTabs
            label="Record source"
            value={source}
            onChange={(value) => {
              setSource(value)
              reset()
            }}
            options={[
              { value: 'ledger', label: 'Account activity', count: counts.ledger },
              { value: 'payments', label: 'Payments', count: counts.payments },
            ]}
          />
          <span>
            {count > records.length
              ? `Latest ${records.length} of ${count} records`
              : `${count} records`}
          </span>
        </div>
        <div className="transactions-toolbar">
          <label className="account-search">
            <Search size={17} />
            <input
              aria-label="Search transactions"
              placeholder="Search description or reference"
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
                <X size={15} />
              </button>
            )}
          </label>
          <SmartSelect
            label="Transaction type"
            value={type}
            onChange={(value) => {
              setType(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All types' },
              ...types.map((value) => ({ value, label: readable(value) })),
            ]}
            searchable={false}
          />
          <SmartSelect
            label="Transaction status"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All statuses' },
              ...statuses.map((value) => ({ value, label: readable(value) })),
            ]}
            searchable={false}
          />
          <SmartSelect
            label="Transaction month"
            value={month}
            onChange={(value) => {
              setMonth(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'All months' },
              ...months.map((value) => ({ value, label: monthLabel(value) })),
            ]}
            searchable={false}
          />
        </div>
        {hasFilters && (
          <div className="transactions-filter-summary">
            <span>{filtered.length} matching records</span>
            <button type="button" className="account-text-link" onClick={reset}>
              Clear filters
              <X size={13} />
            </button>
          </div>
        )}
        {filtered.length ? (
          <>
            <div className="transactions-table-wrap">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="account-align-right">Amount</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(pagination.start, pagination.end).map((record) => (
                    <tr key={record.id}>
                      <td>
                        <button
                          type="button"
                          className="transaction-title"
                          onClick={() => setSelectedId(record.id)}
                        >
                          <strong>{readable(record.type)}</strong>
                          <span>{record.description || record.reference || 'No description'}</span>
                          <small className="transaction-mobile-date">
                            {shortDate(record.date)}
                          </small>
                        </button>
                        <span className="transaction-mobile-status">
                          <StatusBadge status={record.status} />
                        </span>
                      </td>
                      <td className="transaction-date">{shortDate(record.date)}</td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="account-align-right">
                        <Amount value={record.amount} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="account-icon-button"
                          aria-label={`View ${readable(record.type)} of ${record.amount} on ${shortDate(record.date)}`}
                          onClick={() => setSelectedId(record.id)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} total={filtered.length} size={12} onChange={setPage} />
          </>
        ) : (
          <AccountEmpty
            title={hasFilters ? 'No matching transactions' : 'No records yet'}
            text={
              hasFilters
                ? 'Try another search or clear your filters.'
                : source === 'ledger'
                  ? 'Account activity will appear here when it is recorded.'
                  : 'Your payment submissions and review status will appear here.'
            }
            action={
              hasFilters && (
                <button type="button" className="btn-secondary" onClick={reset}>
                  Clear filters
                </button>
              )
            }
          />
        )}
      </section>
      <p className="transactions-footnote">
        {source === 'ledger'
          ? 'Account activity and payment submissions are shown separately to avoid counting the same payment twice.'
          : 'A payment submission is not a confirmed contribution until approved.'}{' '}
        Download your statement for the complete monthly savings and deduction records.
        {count > records.length && ' Search and filters apply to the records loaded here.'}
      </p>
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? readable(selected.type) : 'Transaction details'}
        subtitle={selected ? shortDate(selected.date) : undefined}
      >
        {selected && (
          <>
            <StatusBadge status={selected.status} />
            <div className="account-detail-amount">
              <span>Amount</span>
              <strong>
                <Amount value={selected.amount} />
              </strong>
            </div>
            <DetailRows
              rows={[
                {
                  label: 'Record source',
                  value: source === 'ledger' ? 'Account activity' : 'Payment submission',
                },
                { label: 'Reference', value: selected.reference || 'Not provided' },
                { label: 'Transaction date', value: shortDate(selected.date) },
                { label: 'Recorded on', value: shortDate(selected.createdAt) },
                ...(source === 'payments'
                  ? [
                      {
                        label: 'Reviewed on',
                        value: selected.reviewedAt
                          ? shortDate(selected.reviewedAt)
                          : 'Not reviewed',
                      },
                    ]
                  : []),
                { label: 'Description', value: selected.description || 'None' },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}
