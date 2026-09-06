'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  HandCoins,
  Package,
  Plus,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/overview'
import { StatementDownload } from '@/components/member/statement-download'

interface MemberDashboardProps {
  isPrivileged?: boolean
  user: {
    id: string
    name: string | null
    email: string
    status: string
    staffId: string | null
    department: string | null
    createdAt: string
    balance: number
    specialBalance: number
    totalContributions: number
    loanBalance: number
    monthlyContribution: number | null
    specialContribution: number | null
  }
  loanEligibility: number
  loanSummary: {
    approvedCount: number
    approvedAmount: number
    paidAmount: number
    outstandingAmount: number
    repaymentStartPeriod: string | null
  }
  commoditySummary: {
    commodityCount: number
    commodityCollected: number
    commodityPaid: number
    commodityOutstanding: number
    commodityRepaymentStartPeriod: string | null
    ledgerPeriod: string | null
  }
  recentPayments: DashboardPayment[]
  recentLoans: DashboardLoan[]
  recentCommodities: {
    id: string
    itemCategory: string | null
    itemModel: string | null
    status: string
    createdAt: string | Date
  }[]
}

export type DashboardPayment = {
  id: string
  type: string
  amount: number
  date: string | Date
  createdAt: string | Date
  status: string
}

export type DashboardLoan = {
  id: string
  purpose: string
  duration: number
  amount: number
  status: string
  createdAt: string | Date
}

export function MemberDashboard({
  isPrivileged = false,
  user,
  loanSummary,
  commoditySummary,
  recentPayments,
  recentLoans,
  recentCommodities,
}: MemberDashboardProps) {
  const [showAmounts, setShowAmounts] = useState(true)
  const money = (amount: number) => (showAmounts ? formatCurrency(amount) : '••••••')
  const personal = (href: string) =>
    isPrivileged ? `${href}${href.includes('?') ? '&' : '?'}view=member` : href
  const totalSavings = user.balance + user.specialBalance
  const hasRepayments = [
    loanSummary.approvedCount,
    loanSummary.approvedAmount,
    loanSummary.paidAmount,
    loanSummary.outstandingAmount,
    commoditySummary.commodityCount,
    commoditySummary.commodityCollected,
    commoditySummary.commodityPaid,
    commoditySummary.commodityOutstanding,
  ].some((value) => value > 0)
  const monthlyThrift = user.monthlyContribution || 0
  const monthlySpecial = user.specialContribution || 0
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-NG', {
    month: 'short',
    year: 'numeric',
  })
  const requests = [
    ...recentLoans.map((loan) => ({
      id: `loan-${loan.id}`,
      type: 'Loan',
      detail: loan.purpose,
      amount: loan.amount,
      status: loan.status,
      date: loan.createdAt,
      href: personal('/dashboard/my-loans'),
    })),
    ...recentCommodities.map((item) => ({
      id: `commodity-${item.id}`,
      type: 'Commodity',
      detail: item.itemModel || item.itemCategory || 'Commodity request',
      amount: null,
      status: item.status,
      date: item.createdAt,
      href: personal('/dashboard/commodity'),
    })),
  ]
    .sort(
      (a, b) =>
        Number(b.status === 'PENDING') - Number(a.status === 'PENDING') ||
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, 3)

  if (user.status === 'PENDING')
    return (
      <section className="member-pending">
        <span className="member-pending-icon">
          <Clock3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Membership under review</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your application has been submitted. Your account will be available after admin
            approval.
          </p>
          <StatusBadge status="PENDING" />
        </div>
      </section>
    )

  return (
    <div className="member-overview" data-testid="member-overview">
      <header className="member-overview-header">
        <div>
          <h1>Overview</h1>
          <p>
            <span className="member-account-status">
              <span />
              {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
            </span>
            <span className="member-header-divider">/</span>Member since {memberSince}
          </p>
        </div>
        <StatementDownload className="member-statement">
          <span>
            Statement <span className="member-csv">CSV</span>
          </span>
        </StatementDownload>
      </header>

      <section className="member-savings-panel" aria-labelledby="savings-title">
        <div className="member-savings-main">
          <div className="flex items-center gap-3">
            <h2 id="savings-title">Total savings balance</h2>
            <button
              type="button"
              onClick={() => setShowAmounts((value) => !value)}
              aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
              aria-pressed={!showAmounts}
              className="member-visibility"
            >
              {showAmounts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <p className="member-balance" data-testid="total-savings">
            {money(totalSavings)}
          </p>
          <dl className="member-savings-split">
            <div>
              <dt>
                <span className="member-savings-dot" />
                Thrift savings
              </dt>
              <dd data-testid="thrift-savings">{money(user.balance)}</dd>
            </div>
            <div>
              <dt>
                <span className="member-savings-dot special" />
                Special savings
              </dt>
              <dd data-testid="special-savings">{money(user.specialBalance)}</dd>
            </div>
          </dl>
        </div>
        <div className="member-monthly-plan">
          <h2>Monthly contributions</h2>
          <dl>
            <div>
              <dt>Thrift</dt>
              <dd>{money(monthlyThrift)}</dd>
            </div>
            <div>
              <dt>Special</dt>
              <dd>{money(monthlySpecial)}</dd>
            </div>
            <div className="member-monthly-total">
              <dt>Total / month</dt>
              <dd>{money(monthlyThrift + monthlySpecial)}</dd>
            </div>
          </dl>
          <p>
            <CalendarDays className="h-3.5 w-3.5" /> Automatic payroll deduction
          </p>
        </div>
      </section>

      <nav className="member-quick-actions" aria-label="Account actions">
        <Link href={personal('/dashboard/apply-loan')} className="primary">
          <Plus className="h-4 w-4" />
          Apply for a loan
        </Link>
        <Link href={personal('/dashboard/commodity')}>
          <Package className="h-4 w-4" />
          Request commodity
        </Link>
        <Link href={personal('/dashboard/withdrawals')}>
          <ArrowUpRight className="h-4 w-4" />
          Withdraw special savings
        </Link>
      </nav>

      <section className="member-repayments" aria-labelledby="repayments-title">
        <div className="member-section-heading">
          <h2 id="repayments-title">Loans & commodity</h2>
          <span>Repayment summary</span>
        </div>
        {hasRepayments && (
          <div className="member-repayment-head" aria-hidden="true">
            <span>Account</span>
            <span>Amount received</span>
            <span>Repaid</span>
            <span>Outstanding</span>
            <span />
          </div>
        )}
        <DebtRow
          title="Loan"
          received={loanSummary.approvedAmount}
          paid={loanSummary.paidAmount}
          outstanding={loanSummary.outstandingAmount}
          count={loanSummary.approvedCount}
          href={personal('/dashboard/my-loans')}
          money={money}
        />
        <DebtRow
          title="Commodity"
          received={commoditySummary.commodityCollected}
          paid={commoditySummary.commodityPaid}
          outstanding={commoditySummary.commodityOutstanding}
          count={commoditySummary.commodityCount}
          href={personal('/dashboard/commodity')}
          money={money}
        />
      </section>

      <div className="member-updates-grid">
        <section className="member-updates" aria-labelledby="payments-title">
          <div className="member-section-heading">
            <h2 id="payments-title">Recent payments</h2>
            <Link href={personal('/dashboard/history')}>
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentPayments.length ? (
            <ul>
              {recentPayments.slice(0, 3).map((payment) => (
                <li key={payment.id} className="member-payment-row">
                  <span className="member-payment-icon">
                    <ArrowDownLeft className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="capitalize">{payment.type.toLowerCase().replaceAll('_', ' ')}</p>
                    <span>{formatDate(payment.date || payment.createdAt)}</span>
                  </div>
                  <div className="text-right">
                    <strong>{money(payment.amount)}</strong>
                    <span>{payment.status.charAt(0) + payment.status.slice(1).toLowerCase()}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="member-quiet-state">
              <p>No recent payments recorded.</p>
              <StatementDownload className="btn-ghost mt-3">
                Download your full statement
              </StatementDownload>
            </div>
          )}
        </section>
        <section className="member-updates" aria-labelledby="requests-title">
          <div className="member-section-heading">
            <h2 id="requests-title">Requests</h2>
            <span>Latest updates</span>
          </div>
          {requests.length ? (
            <ul>
              {requests.map((request) => (
                <li key={request.id}>
                  <Link href={request.href} className="member-request-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p>{request.type}</p>
                        {request.amount !== null && (
                          <span className="member-request-amount">{money(request.amount)}</span>
                        )}
                      </div>
                      <span className="member-request-detail">{request.detail}</span>
                    </div>
                    <StatusBadge status={request.status} />
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="member-quiet-state">
              <p>No loan or commodity requests.</p>
              <span>Your request status will appear here.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function DebtRow({
  title,
  received,
  paid,
  outstanding,
  count,
  href,
  money,
}: {
  title: string
  received: number
  paid: number
  outstanding: number
  count: number
  href: string
  money: (value: number) => string
}) {
  const hasRecord = count > 0 || received > 0 || paid > 0 || outstanding > 0
  return (
    <div
      className={`member-debt-row ${hasRecord ? '' : 'empty'}`}
      data-testid={`${title.toLowerCase()}-summary`}
    >
      <h3>
        <span className="member-debt-icon">
          {title === 'Loan' ? <HandCoins className="h-4 w-4" /> : <Package className="h-4 w-4" />}
        </span>
        {title}
      </h3>
      {hasRecord ? (
        <>
          <div className="member-debt-value">
            <span>Amount received</span>
            <strong>{received > 0 ? money(received) : 'Not recorded'}</strong>
          </div>
          <div className="member-debt-value paid">
            <span>Repaid</span>
            <strong>{money(paid)}</strong>
          </div>
          <div className="member-debt-value outstanding">
            <span>Outstanding</span>
            <strong>
              {received > 0 || outstanding > 0 ? money(outstanding) : 'Not available'}
            </strong>
          </div>
        </>
      ) : (
        <p className="member-no-debt">
          No {title === 'Loan' ? 'loan disbursement' : 'commodity purchase'} recorded
        </p>
      )}
      <Link
        href={href}
        className="member-debt-link"
        aria-label={`View ${title.toLowerCase()} details`}
      >
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
