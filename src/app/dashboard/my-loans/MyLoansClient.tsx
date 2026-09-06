'use client'

import { paginationState } from '@/components/ui/pagination-state'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, ArrowUpRight } from 'lucide-react'
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
  StatementLink,
} from '@/components/member/account-ui'

export type LoanRecord = {
  id: string
  amount: number
  purpose: string
  duration: number
  interestRate: number
  monthlyPayment: number | null
  totalRepayable: number | null
  balance: number
  status: string
  approvedAt: string | null
  createdAt: string
  disbursementBankName: string | null
  disbursementAccountNumber: string | null
  disbursementAccountName: string | null
  repayments: { id: string; amount: number; date: string }[]
}

export default function MyLoansClient({
  loans,
  totals,
}: {
  loans: LoanRecord[]
  totals: { collected: number; paid: number; outstanding: number; period: string | null }
}) {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = loans.find((loan) => loan.id === selectedId)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const hasLedgerOnly =
    !loans.some((loan) => ['APPROVED', 'COMPLETED'].includes(loan.status)) &&
    (totals.collected > 0 || totals.paid > 0 || totals.outstanding > 0)
  const matches = (status: string) =>
    filter === 'all' ||
    (filter === 'active'
      ? status === 'APPROVED'
      : filter === 'review'
        ? status === 'PENDING'
        : ['COMPLETED', 'REJECTED'].includes(status))
  const filtered = loans.filter((loan) => matches(loan.status))
  const pagination = paginationState(page, filtered.length, 6)

  return (
    <div className="account-page">
      <PageHeading
        title="My loans"
        description="What you received. What you repaid. What's left."
        actions={
          <>
            <StatementLink />
            <Link className="btn-primary" href="/dashboard/apply-loan">
              <Plus size={17} />
              Request a loan
            </Link>
          </>
        }
      />
      <BalanceStrip
        {...totals}
        label="Loan received"
        outstandingLabel="Principal outstanding"
        note="Principal after recorded deductions. Administration charges are shown in each loan's details."
      />
      {hasLedgerOnly && (
        <section className="account-panel">
          <button type="button" className="loan-ledger-record" onClick={() => setLedgerOpen(true)}>
            <div>
              <span className="account-kicker">Recorded by your admin</span>
              <h2>Loan account</h2>
              <p>Repayments from your monthly records</p>
            </div>
            <div>
              <strong>
                <Amount
                  value={totals.outstanding}
                  unknown={totals.collected <= 0 && totals.paid > 0 && totals.outstanding <= 0}
                />
              </strong>
              <span>Outstanding</span>
            </div>
            <ChevronRight size={20} />
          </button>
        </section>
      )}
      <section className="account-panel">
        <div className="account-section-head">
          <h2>Loan requests</h2>
          <span>{loans.length} total</span>
        </div>
        <FilterTabs
          value={filter}
          onChange={(value) => {
            setFilter(value)
            setPage(1)
          }}
          options={[
            { value: 'all', label: 'All requests' },
            { value: 'active', label: 'Approved' },
            {
              value: 'review',
              label: 'Under review',
              count: loans.filter((loan) => loan.status === 'PENDING').length,
            },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        {filtered.length ? (
          <div className="loan-record-grid">
            {filtered.slice(pagination.start, pagination.end).map((loan) => (
              <button
                type="button"
                className="loan-record"
                key={loan.id}
                onClick={() => setSelectedId(loan.id)}
              >
                <div className="loan-record-top">
                  <span>{shortDate(loan.createdAt)}</span>
                  <StatusBadge status={loan.status} />
                </div>
                <strong className="loan-record-amount">
                  <Amount value={loan.amount} />
                </strong>
                <h3>{loan.purpose}</h3>
                <div className="loan-record-bottom">
                  <span>
                    {loan.duration} months
                    {loan.monthlyPayment != null && (
                      <>
                        {' '}
                        · <Amount value={loan.monthlyPayment} /> / mo
                      </>
                    )}
                  </span>
                  <span>
                    Details
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <AccountEmpty
            title={loans.length ? 'No loans in this view' : 'No loan requests yet'}
            text={
              loans.length
                ? 'Choose another filter to see your requests.'
                : hasLedgerOnly
                  ? 'Your existing loan is shown above. New applications will appear here.'
                  : 'When you apply, you can follow approval and repayment details here.'
            }
          />
        )}
        {filtered.length > 6 && (
          <Pagination page={pagination.page} total={filtered.length} size={6} onChange={setPage} />
        )}
      </section>
      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title="Loan details"
        subtitle={selected ? `Requested ${shortDate(selected.createdAt)}` : undefined}
      >
        {selected && (
          <>
            <StatusBadge status={selected.status} />
            <div className="account-detail-amount">
              <span>
                {selected.status === 'PENDING' || selected.status === 'REJECTED'
                  ? 'Amount requested'
                  : 'Loan amount'}
              </span>
              <strong>
                <Amount value={selected.amount} />
              </strong>
              <p>{selected.purpose}</p>
            </div>
            <DetailRows
              rows={[
                { label: 'Repayment term', value: `${selected.duration} months` },
                {
                  label: 'Monthly repayment',
                  value:
                    selected.monthlyPayment != null ? (
                      <Amount value={selected.monthlyPayment} />
                    ) : (
                      'Not set'
                    ),
                },
                { label: 'Administration charge', value: `${selected.interestRate}%` },
                {
                  label: 'Total repayable',
                  value:
                    selected.totalRepayable != null ? (
                      <Amount value={selected.totalRepayable} />
                    ) : (
                      'Not set'
                    ),
                },
                ...(selected.approvedAt
                  ? [{ label: 'Approved on', value: shortDate(selected.approvedAt) }]
                  : []),
              ]}
            />
            {selected.disbursementBankName && (
              <section className="account-detail-section">
                <h3>Payout account</h3>
                <DetailRows
                  rows={[
                    { label: 'Bank', value: selected.disbursementBankName },
                    { label: 'Account number', value: selected.disbursementAccountNumber },
                    { label: 'Account name', value: selected.disbursementAccountName },
                  ]}
                />
              </section>
            )}
            {['APPROVED', 'COMPLETED'].includes(selected.status) && (
              <section className="account-detail-section">
                <h3>Recorded repayments for this loan</h3>
                <p className="account-caption">
                  The account summary includes your monthly ledger deductions. The entries below are
                  payments linked directly to this request.
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
            {selected.status === 'PENDING' && (
              <p className="account-inset">
                Your application is with your admin for review. No repayment schedule is active yet.
              </p>
            )}
          </>
        )}
      </Drawer>
      <Drawer
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        title="Recorded loan account"
        subtitle="Includes the amounts entered by your admin."
      >
        <DetailRows
          rows={[
            {
              label: 'Amount received',
              value: (
                <Amount
                  value={totals.collected}
                  unknown={totals.collected <= 0 && (totals.paid > 0 || totals.outstanding > 0)}
                />
              ),
            },
            { label: 'Repaid so far', value: <Amount value={totals.paid} /> },
            {
              label: 'Outstanding',
              value: (
                <Amount
                  value={totals.outstanding}
                  unknown={totals.collected <= 0 && totals.paid > 0 && totals.outstanding <= 0}
                />
              ),
            },
          ]}
        />
        <p className="account-caption">
          Download your statement for the monthly deduction entries. Contact your admin if the
          original loan amount is missing or incorrect.
        </p>
        <StatementLink />
      </Drawer>
    </div>
  )
}
