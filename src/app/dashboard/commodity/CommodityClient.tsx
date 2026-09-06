'use client'

import { paginationState } from '@/components/ui/pagination-state'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, ChevronRight, Package, Plus } from 'lucide-react'
import { PageHeading, StatusBadge } from '@/components/ui/overview'
import {
  AccountEmpty,
  Amount,
  BalanceStrip,
  DetailRows,
  Drawer,
  FilterTabs,
  Pagination,
  shortDate,
} from '@/components/member/account-ui'

export type CommodityRecord = {
  id: string
  itemCategory: string
  preferredBudget: number
  notes: string | null
  status: string
  createdAt: string
  adminQuotedPrice: number | null
  adminApprovedMonths: number | null
  adminMonthlyRepayment: number | null
  adminFeedback: string | null
  repayments: { id: string; amount: number; date: string }[]
}
type Result = { success?: boolean; error?: string }

export default function CommodityClient({
  requests,
  totals,
  submitAction,
  cancelAction,
}: {
  requests: CommodityRecord[]
  totals: { collected: number; paid: number; outstanding: number; period: string | null }
  submitAction: (data: FormData) => Promise<Result>
  cancelAction: (data: FormData) => Promise<Result>
}) {
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = requests.find((request) => request.id === selectedId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [draft, setDraft] = useState({ itemName: '', preferredPrice: '', notes: '' })
  const matches = (status: string, tab: string) =>
    tab === 'all' ||
    (tab === 'review'
      ? ['PENDING', 'OFFERED'].includes(status)
      : tab === 'approved'
        ? status === 'APPROVED'
        : ['REJECTED', 'CANCELLED'].includes(status))
  const filtered = requests.filter((request) => matches(request.status, filter))
  const options = [
    { value: 'all', label: 'All requests' },
    { value: 'review', label: 'Under review' },
    { value: 'approved', label: 'Approved' },
    { value: 'closed', label: 'Closed' },
  ].map((option) => ({
    ...option,
    count: requests.filter((request) => matches(request.status, option.value)).length,
  }))
  function openNew() {
    setError('')
    setCreateOpen(true)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const result = await submitAction(data)
      if (result.error) {
        setError(result.error)
        return
      }
      setCreateOpen(false)
      setDraft({ itemName: '', preferredPrice: '', notes: '' })
      setFilter('all')
      setPage(1)
      setNotice('Request sent. Your admin will contact you with the next steps.')
      router.refresh()
    } catch {
      setError('Your request could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  async function cancel() {
    if (!selected || busy) return
    const data = new FormData()
    data.set('requestId', selected.id)
    setBusy(true)
    setError('')
    try {
      const result = await cancelAction(data)
      if (result.error) {
        setError(result.error)
        return
      }
      setSelectedId(null)
      setConfirmCancel(false)
      setNotice('Request cancelled.')
      router.refresh()
    } catch {
      setError('Unable to cancel this request. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const pagination = paginationState(page, filtered.length, 8)

  return (
    <div className="account-page">
      <PageHeading
        title="Commodity"
        description="Your requests, costs and repayments."
        actions={
          <button type="button" className="btn-primary" onClick={openNew}>
            <Plus size={17} />
            New request
          </button>
        }
      />
      <BalanceStrip {...totals} label="Commodity received" />
      {notice && (
        <p className="account-notice" role="status">
          {notice}
        </p>
      )}
      <section className="account-panel">
        <div className="account-section-head">
          <h2>Requests</h2>
          <span>{requests.length} total</span>
        </div>
        <FilterTabs
          options={options}
          value={filter}
          onChange={(value) => {
            setFilter(value)
            setPage(1)
          }}
        />
        {filtered.length === 0 ? (
          <AccountEmpty
            title={requests.length ? 'No requests in this view' : 'Nothing requested yet'}
            text={
              requests.length
                ? 'Choose another filter to see your requests.'
                : 'Tell us what you need. Your admin will confirm the cost and repayment terms.'
            }
            action={
              !requests.length && (
                <button type="button" className="btn-secondary" onClick={openNew}>
                  Make a request
                  <ArrowUpRight size={16} />
                </button>
              )
            }
          />
        ) : (
          <div className="account-list">
            {filtered.slice(pagination.start, pagination.end).map((request) => (
              <button
                type="button"
                className="account-record"
                key={request.id}
                onClick={() => {
                  setSelectedId(request.id)
                  setError('')
                  setConfirmCancel(false)
                }}
              >
                <span className="account-record-icon">
                  <Package size={20} strokeWidth={1.6} />
                </span>
                <span className="account-record-title">
                  <strong>{request.itemCategory}</strong>
                  <small>
                    {shortDate(request.createdAt)}
                    <span className="account-inline-dot">·</span>
                    {request.adminQuotedPrice != null ? 'Quoted cost' : 'Requested budget'}
                  </small>
                </span>
                <span className="account-record-value">
                  <strong>
                    {request.adminQuotedPrice != null || request.preferredBudget > 0 ? (
                      <Amount value={request.adminQuotedPrice ?? request.preferredBudget} />
                    ) : (
                      'Awaiting quote'
                    )}
                  </strong>
                  <StatusBadge status={request.status} />
                </span>
                <ChevronRight className="account-record-chevron" size={18} />
              </button>
            ))}
          </div>
        )}
        {filtered.length > 8 && (
          <Pagination page={pagination.page} total={filtered.length} size={8} onChange={setPage} />
        )}
      </section>
      <Drawer
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setError('')
        }}
        title="New commodity request"
        subtitle="Your admin will review this before approval."
        busy={busy}
      >
        <form onSubmit={submit} className="account-form">
          <label>
            What do you need?
            <input
              autoFocus
              className="settings-input"
              name="itemName"
              value={draft.itemName}
              onChange={(e) => setDraft({ ...draft, itemName: e.target.value })}
              placeholder="e.g. A refrigerator"
              maxLength={160}
              required
              disabled={busy}
            />
          </label>
          <label>
            Preferred budget <span className="account-optional">optional</span>
            <div className="account-currency-input">
              <span>₦</span>
              <input
                className="settings-input"
                name="preferredPrice"
                type="number"
                min="0"
                step="0.01"
                value={draft.preferredPrice}
                onChange={(e) => setDraft({ ...draft, preferredPrice: e.target.value })}
                placeholder="0.00"
                disabled={busy}
              />
            </div>
          </label>
          <label>
            Anything else? <span className="account-optional">optional</span>
            <textarea
              className="settings-input"
              name="notes"
              rows={4}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Brand, model, quantity or other details"
              maxLength={2000}
              disabled={busy}
            />
          </label>
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
          <div className="account-form-footer">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setCreateOpen(false)}
            >
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Sending request…' : 'Send request'}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
      </Drawer>
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.itemCategory || 'Request details'}
        subtitle={selected ? `Requested ${shortDate(selected.createdAt)}` : undefined}
        busy={busy}
      >
        {selected && (
          <>
            <StatusBadge status={selected.status} />
            <div className="account-detail-amount">
              <span>{selected.adminQuotedPrice != null ? 'Quoted cost' : 'Requested budget'}</span>
              <strong>
                {selected.adminQuotedPrice != null || selected.preferredBudget > 0 ? (
                  <Amount value={selected.adminQuotedPrice ?? selected.preferredBudget} />
                ) : (
                  'Awaiting quote'
                )}
              </strong>
            </div>
            <DetailRows
              rows={[
                {
                  label: 'Repayment term',
                  value: selected.adminApprovedMonths
                    ? `${selected.adminApprovedMonths} months`
                    : 'Not set',
                },
                {
                  label: 'Monthly repayment',
                  value:
                    selected.adminMonthlyRepayment != null ? (
                      <Amount value={selected.adminMonthlyRepayment} />
                    ) : (
                      'Not set'
                    ),
                },
                { label: 'Your notes', value: selected.notes || 'None' },
              ]}
            />
            {selected.adminFeedback && (
              <section className="account-inset">
                <h3>From your admin</h3>
                <p>{selected.adminFeedback}</p>
              </section>
            )}
            {selected.status === 'APPROVED' && (
              <section className="account-detail-section">
                <h3>Recorded repayments for this request</h3>
                <p className="account-caption">
                  Monthly ledger deductions are included in your account summary above.
                </p>
                {selected.repayments.length ? (
                  <DetailRows
                    rows={selected.repayments.map((payment, index) => ({
                      label: `${shortDate(payment.date)}${index ? ` · ${index + 1}` : ''}`,
                      value: <Amount value={payment.amount} />,
                    }))}
                  />
                ) : (
                  <p className="account-caption">No separate repayments recorded.</p>
                )}
              </section>
            )}
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
            {selected.status === 'PENDING' && (
              <div className="account-form-footer">
                {confirmCancel ? (
                  <div className="account-confirm">
                    <p>Cancel this request? You can submit a new one later.</p>
                    <div>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => setConfirmCancel(false)}
                      >
                        Keep request
                      </button>
                      <button
                        type="button"
                        className="account-danger-button"
                        disabled={busy}
                        onClick={cancel}
                      >
                        {busy ? 'Cancelling…' : 'Confirm cancellation'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="account-text-danger"
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel request
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}
