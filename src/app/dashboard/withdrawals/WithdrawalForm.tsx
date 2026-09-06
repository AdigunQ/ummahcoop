'use client'

import { paginationState } from '@/components/ui/pagination-state'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Landmark,
  LockKeyhole,
  CalendarDays,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react'
import { PageHeading, StatusBadge } from '@/components/ui/overview'
import {
  AccountEmpty,
  Amount,
  DetailRows,
  Drawer,
  Pagination,
  shortDate,
} from '@/components/member/account-ui'
import { submitWithdrawalRequest } from './actions'

type Withdrawal = {
  id: string
  source: string
  requestedAmount: number
  approvedAmount: number | null
  status: string
  reason: string | null
  requestedAt: string
  reviewedAt: string | null
  payoutBankName: string | null
  payoutAccountNumber: string | null
  payoutAccountName: string | null
}
export default function WithdrawalForm({
  member,
  isOctober,
  nextOctoberYear,
}: {
  member: {
    balance: number
    specialBalance: number
    bankName: string | null
    bankAccountName: string | null
    bankAccountNumber: string | null
    withdrawals: Withdrawal[]
  }
  isOctober: boolean
  nextOctoberYear: number
}) {
  const router = useRouter()
  const [review, setReview] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = member.withdrawals.find((request) => request.id === selectedId)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const pending = member.withdrawals.find((request) => request.status === 'PENDING')
  const canRequest = isOctober && member.specialBalance > 0 && !pending
  const bankReady = !!(member.bankName && member.bankAccountNumber && member.bankAccountName)
  async function submit() {
    if (busy || !canRequest) return
    setBusy(true)
    setError('')
    const data = new FormData()
    data.set('source', 'SPECIAL_SAVINGS')
    data.set('reason', reason)
    try {
      const result = await submitWithdrawalRequest(data)
      if (result.error) {
        setError(result.error)
        return
      }
      setReview(false)
      setReason('')
      setNotice('Withdrawal requested. Your admin will review it before payment.')
      router.refresh()
    } catch {
      setError('Unable to send your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const pagination = paginationState(page, member.withdrawals.length, 6)

  return (
    <div className="account-page">
      <PageHeading
        title="Withdraw funds"
        description="Special savings, paid to your bank account."
      />
      {notice && (
        <p className="account-notice" role="status">
          {notice}
        </p>
      )}
      <div className="withdrawal-layout">
        <section className="account-panel withdrawal-main">
          <div className="account-section-head">
            <h2>Special savings</h2>
            <span className={`account-availability ${canRequest ? 'is-open' : ''}`}>
              <span />
              {pending
                ? 'Under review'
                : isOctober
                  ? 'October window open'
                  : `Opens October ${nextOctoberYear}`}
            </span>
          </div>
          <div className="withdrawal-balance">
            <span>Your balance</span>
            <strong>
              <Amount value={member.specialBalance} />
            </strong>
            <p>Full balance withdrawal. No partial amounts.</p>
          </div>
          <div className="withdrawal-rule">
            {pending ? (
              <>
                <CalendarDays size={20} />
                <div>
                  <strong>Request awaiting approval</strong>
                  <p>
                    Submitted {shortDate(pending.requestedAt)} for{' '}
                    <Amount value={pending.requestedAmount} />.
                  </p>
                  <button
                    type="button"
                    className="account-text-link"
                    onClick={() => setSelectedId(pending.id)}
                  >
                    View request
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : !isOctober ? (
              <>
                <LockKeyhole size={20} />
                <div>
                  <strong>Available in October</strong>
                  <p>
                    Special savings can be withdrawn every October, regardless of when you started
                    saving.
                  </p>
                </div>
              </>
            ) : member.specialBalance <= 0 ? (
              <>
                <Landmark size={20} />
                <div>
                  <strong>No special savings to withdraw</strong>
                  <p>Your balance will appear here as contributions are recorded.</p>
                </div>
              </>
            ) : (
              <>
                <CalendarDays size={20} />
                <div>
                  <strong>You can request your full balance</strong>
                  <p>Your admin reviews the request before payment.</p>
                </div>
              </>
            )}
          </div>
          {canRequest && (
            <div className="withdrawal-action">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setError('')
                  setReview(true)
                }}
              >
                Review withdrawal
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
        <aside className="withdrawal-sidebar">
          <section className="account-panel withdrawal-bank">
            <div className="account-section-head">
              <h2>Payout account</h2>
              <Landmark size={18} />
            </div>
            {bankReady ? (
              <div className="withdrawal-bank-details">
                <strong>{member.bankName}</strong>
                <span className="account-money">{member.bankAccountNumber}</span>
                <small>{member.bankAccountName}</small>
              </div>
            ) : (
              <p className="account-caption">
                Add or check your bank details before requesting a withdrawal.
              </p>
            )}
            <Link href="/dashboard/profile" className="account-text-link">
              {bankReady ? 'Manage bank details' : 'Add bank details'}
              <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="withdrawal-thrift">
            <div>
              <LockKeyhole size={15} />
              <span>Thrift savings</span>
              <strong>
                <Amount value={member.balance} />
              </strong>
            </div>
            <p>Available only when closing your membership.</p>
            <Link className="account-text-link" href="/dashboard/delete-account">
              Membership closure
              <ArrowUpRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
      <section className="account-panel">
        <div className="account-section-head">
          <h2>Withdrawal history</h2>
          <span>{member.withdrawals.length} requests</span>
        </div>
        {member.withdrawals.length ? (
          <>
            <div className="account-list">
              {member.withdrawals.slice(pagination.start, pagination.end).map((request) => (
                <button
                  type="button"
                  key={request.id}
                  className="account-record"
                  onClick={() => setSelectedId(request.id)}
                >
                  <span className="account-record-icon">
                    <ArrowUpRight size={20} />
                  </span>
                  <span className="account-record-title">
                    <strong>
                      {request.source === 'SPECIAL_SAVINGS' ? 'Special savings' : 'Thrift savings'}
                    </strong>
                    <small>{shortDate(request.requestedAt)}</small>
                  </span>
                  <span className="account-record-value">
                    <strong>
                      <Amount value={request.requestedAmount} />
                    </strong>
                    <StatusBadge status={request.status} />
                  </span>
                  <ChevronRight size={18} className="account-record-chevron" />
                </button>
              ))}
            </div>
            {member.withdrawals.length > 6 && (
              <Pagination
                page={pagination.page}
                total={member.withdrawals.length}
                size={6}
                onChange={setPage}
              />
            )}
          </>
        ) : (
          <AccountEmpty
            title="No withdrawals yet"
            text="Your requests and their approval status will appear here."
          />
        )}
      </section>
      <Drawer
        open={review}
        onClose={() => setReview(false)}
        title="Review withdrawal"
        subtitle="Check these details before sending."
        busy={busy}
      >
        <div className="account-detail-amount">
          <span>Amount requested</span>
          <strong>
            <Amount value={member.specialBalance} />
          </strong>
        </div>
        <DetailRows
          rows={[
            { label: 'From', value: 'Special savings' },
            { label: 'Bank', value: member.bankName },
            { label: 'Account number', value: member.bankAccountNumber },
            { label: 'Account name', value: member.bankAccountName },
          ]}
        />
        {!bankReady && (
          <p className="account-error">
            Your bank details are incomplete.{' '}
            <Link href="/dashboard/profile">Update your profile</Link> so your admin can arrange
            payment.
          </p>
        )}
        <form
          className="account-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label>
            Note to admin <span className="account-optional">optional</span>
            <textarea
              className="settings-input"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              placeholder="Anything your admin should know"
            />
          </label>
          <p className="account-caption">
            This sends a request for approval. It does not transfer money immediately.
          </p>
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <div className="account-form-footer">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !canRequest}>
              {busy ? 'Sending…' : 'Request withdrawal'}
            </button>
          </div>
        </form>
      </Drawer>
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title="Withdrawal details"
        subtitle={selected ? shortDate(selected.requestedAt) : undefined}
      >
        {selected && (
          <>
            <StatusBadge status={selected.status} />
            <div className="account-detail-amount">
              <span>Requested amount</span>
              <strong>
                <Amount value={selected.requestedAmount} />
              </strong>
            </div>
            <DetailRows
              rows={[
                {
                  label: 'Savings account',
                  value:
                    selected.source === 'SPECIAL_SAVINGS' ? 'Special savings' : 'Thrift savings',
                },
                {
                  label: 'Approved amount',
                  value:
                    selected.approvedAmount != null ? (
                      <Amount value={selected.approvedAmount} />
                    ) : (
                      'Not approved'
                    ),
                },
                {
                  label: 'Reviewed',
                  value: selected.reviewedAt ? shortDate(selected.reviewedAt) : 'Awaiting review',
                },
                { label: 'Payout bank', value: selected.payoutBankName },
                { label: 'Account number', value: selected.payoutAccountNumber },
                { label: 'Account name', value: selected.payoutAccountName },
                { label: 'Your note', value: selected.reason || 'None' },
              ]}
            />
            <p className="account-caption">
              Approval status is not confirmation that your bank has received payment.
            </p>
          </>
        )}
      </Drawer>
    </div>
  )
}
