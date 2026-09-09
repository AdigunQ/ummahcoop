import Link from 'next/link'
import { AdminHeading, AdminStats, AdminPanel } from '@/components/admin/admin-ui'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  FileText,
  Landmark,
  PackageSearch,
  Users,
  UserCheck,
  Wallet,
} from 'lucide-react'
import { getCurrentMemberLiveDataset, getCurrentMemberReportDataset } from '@/lib/current-member-data'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { resolveVoucherPeriod } from '@/lib/vouchers'
import { canOpenAdminRoute } from '@/components/admin/overview-access'

type TrendRow = {
  period: string
  label: string
  registrations: number
  newMemberFeeRevenue: number
  chargeRevenue: number
  voucherFees: number
  savingsBasis: number
  voucherTotal: number
}

function toPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodLabel(period: string): string {
  const match = period.trim().match(/^(20\d{2})-(0?[1-9]|1[0-2])$/)
  if (!match) return period

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month)) return period

  return new Date(year, month - 1, 1).toLocaleDateString('en-NG', {
    month: 'short',
    year: 'numeric',
  })
}

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0)
}

function normalizeStaffId(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

export async function AdminAnalytics({
  canSwitchToMember = false,
  privilegeCodes,
}: {
  canSwitchToMember?: boolean
  privilegeCodes?: string[]
}) {
  const now = new Date()
  const currentMonth = resolveVoucherPeriod().period
  const currentLabel = formatPeriodLabel(currentMonth)
  const currentDatasetPromise = getCurrentMemberLiveDataset(currentMonth)

  const [
    currentDataset,
    activeMemberCount,
    activeLoanRecords,
    approvedCommodityRecords,
    queueCounts,
    trends,
  ] = await Promise.all([
    currentDatasetPromise,
    prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE' } }),
    prisma.loan.findMany({
      where: { status: 'APPROVED', balance: { gt: 0 } },
      select: { balance: true, user: { select: { id: true, staffId: true } } },
    }),
    prisma.commodityRequest.findMany({
      where: { status: 'APPROVED' },
      select: {
        adminQuotedPrice: true,
        preferredBudget: true,
        user: { select: { id: true, staffId: true } },
      },
    }),
    Promise.all([
      prisma.user.count({ where: { role: 'MEMBER', status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.loan.count({ where: { status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.commodityRequest.count({ where: { status: 'PENDING' } }),
    ]),
    Promise.all(
      Array.from(
        { length: 6 },
        (_, index) => new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      ).map(async (startDate): Promise<TrendRow> => {
        const start = startDate
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
        const period = toPeriod(start)

        const [registrations, periodDataset] = await Promise.all([
          prisma.user.count({
            where: {
              role: 'MEMBER',
              createdAt: { gte: start, lt: end },
            },
          }),
          period === currentMonth ? currentDatasetPromise : getCurrentMemberReportDataset(period),
        ])

        const newMemberFeeRevenue = sum(periodDataset.rows.map((row) => row.newMemberFee))
        const chargeRevenue = sum(periodDataset.rows.map((row) => row.monthlyCharges))
        const voucherFees = newMemberFeeRevenue + chargeRevenue
        const savingsBasis = sum(periodDataset.rows.map((row) => row.monthlySavings + row.specialSavings))

        return {
          period,
          label: formatPeriodLabel(period),
          registrations,
          newMemberFeeRevenue,
          chargeRevenue,
          voucherFees,
          savingsBasis,
          voucherTotal: voucherFees + savingsBasis,
        }
      })
    ),
  ])

  const [pendingMembers, pendingPayments, pendingLoans, pendingWithdrawals, pendingCommodities] = queueCounts
  const currentRows = currentDataset.rows
  const currentThriftSavings = sum(currentRows.map((row) => row.monthlySavings))
  const currentSpecialSavings = sum(currentRows.map((row) => row.specialSavings))
  const currentFees = sum(currentRows.map((row) => row.memberFee))
  const currentNewMembers = currentRows.filter((row) => row.memberType === 'NEW').length
  const currentOldMembers = currentRows.length - currentNewMembers
  const ledgerLoanRows = currentRows.filter((row) => row.loanAmount > 0)
  const ledgerCommodityRows = currentRows.filter((row) => row.commodityAmount > 0)
  const operationalLoansByStaff = new Map(
    activeLoanRecords.map((loan) => [
      normalizeStaffId(loan.user.staffId) || `user:${loan.user.id}`,
      loan,
    ])
  )
  const countedLoanKeys = new Set<string>()
  let outstandingLoanBalance = 0

  for (const row of ledgerLoanRows) {
    const key = normalizeStaffId(row.staffId)
    const operationalLoan = operationalLoansByStaff.get(key)
    if (operationalLoan) {
      outstandingLoanBalance += operationalLoan.balance
      countedLoanKeys.add(key)
    } else {
      outstandingLoanBalance += row.loanAmount
    }
    countedLoanKeys.add(key)
  }

  operationalLoansByStaff.forEach((loan, key) => {
    if (!countedLoanKeys.has(key)) outstandingLoanBalance += loan.balance
  })

  const activeLoans = new Set([
    ...ledgerLoanRows.map((row) => normalizeStaffId(row.staffId)),
    ...activeLoanRecords.map(
      (loan) => normalizeStaffId(loan.user.staffId) || `user:${loan.user.id}`
    ),
  ]).size

  const commodityAmounts = new Map<string, number>()
  for (const row of ledgerCommodityRows) {
    commodityAmounts.set(normalizeStaffId(row.staffId), row.commodityAmount)
  }
  for (const request of approvedCommodityRecords) {
    const key = normalizeStaffId(request.user.staffId) || `user:${request.user.id}`
    const amount = request.adminQuotedPrice || request.preferredBudget || 0
    commodityAmounts.set(key, Math.max(commodityAmounts.get(key) || 0, amount))
  }
  const activeCommodities = commodityAmounts.size
  const outstandingCommodityBalance = sum(Array.from(commodityAmounts.values()))
  const pendingApprovals = pendingMembers + pendingPayments + pendingLoans + pendingWithdrawals + pendingCommodities

  const totalChargesRevenue = sum(trends.map((row) => row.chargeRevenue))
  const totalNewMemberFeeRevenue = sum(trends.map((row) => row.newMemberFeeRevenue))
  const totalFeeRevenue = totalChargesRevenue + totalNewMemberFeeRevenue

  const maxScheduledSavings = Math.max(1, ...trends.map((row) => row.savingsBasis))
  return (
    <div className="admin-page">
      <AdminHeading
        section="Administration"
        title="Overview"
        description={`Your cooperative at a glance. ${currentLabel}.`}
        actions={
          <>
            <span className="admin-date">
              <CalendarDays size={15} />
              {currentLabel}
            </span>
            {canOpenAdminRoute('/dashboard/vouchers', privilegeCodes) && <Link href="/dashboard/vouchers" className="btn-primary">
              <FileText size={15} />
              Generate report
            </Link>}
          </>
        }
      />
      <div className="admin-overview-top">
        <section className="admin-panel admin-savings-focus">
          <div>
            <span className="admin-eyebrow">This month&apos;s savings</span>
            {canOpenAdminRoute('/dashboard/member-data', privilegeCodes) && <Link href="/dashboard/member-data" className="admin-inline-link">
              Open ledger
              <ArrowUpRight size={15} />
            </Link>}
          </div>
          <strong className="admin-focus-number">
            {formatCurrency(currentThriftSavings + currentSpecialSavings)}
          </strong>
          <p>Scheduled contributions in the {currentLabel} ledger</p>
          <div className="admin-savings-split">
            <div>
              <span>
                <i />
                Thrift savings
              </span>
              <strong>{formatCurrency(currentThriftSavings)}</strong>
            </div>
            <div>
              <span>
                <i />
                Special savings
              </span>
              <strong>{formatCurrency(currentSpecialSavings)}</strong>
            </div>
          </div>
          <div className="admin-savings-bar" aria-hidden="true">
            <span
              style={{
                width: `${(currentThriftSavings / Math.max(1, currentThriftSavings + currentSpecialSavings)) * 100}%`,
              }}
            />
          </div>
        </section>
        <AdminPanel
          title="Pending requests"
          actions={<span className="admin-tag">{pendingApprovals} pending</span>}
        >
          <div className="admin-decision-list">
            {[
              {
                label: 'Memberships',
                count: pendingMembers,
                href: '/dashboard/members',
                icon: UserCheck,
              },
              {
                label: 'Loan requests',
                count: pendingLoans,
                href: '/dashboard/loans',
                icon: CreditCard,
              },
              {
                label: 'Payment reviews',
                count: pendingPayments,
                href: '/dashboard/payments',
                icon: Wallet,
              },
              {
                label: 'Withdrawals',
                count: pendingWithdrawals,
                href: '/dashboard/withdrawals',
                icon: ArrowUpRight,
              },
              {
                label: 'Commodity requests',
                count: pendingCommodities,
                href: '/dashboard/commodity?review=true',
                icon: PackageSearch,
              },
            ].map(({ label, count, href, icon: Icon }) => (
              canOpenAdminRoute(href, privilegeCodes) ? <Link key={label} href={href}>
                <Icon size={16} />
                <span>{label}</span>
                <strong>{count}</strong>
                <ArrowRight size={14} />
              </Link> : <div className="admin-decision-readonly" key={label}><Icon size={16}/><span>{label}</span><strong>{count}</strong></div>
            ))}
          </div>
        </AdminPanel>
      </div>
      <AdminStats
        items={[
          {
            label: 'Members on record',
            value: activeMemberCount.toLocaleString('en-NG'),
            note: `${currentRows.length} in this month's ledger`,
          },
          {
            label: 'Active loans',
            value: String(activeLoans),
            note: `${formatCurrency(outstandingLoanBalance)} recorded exposure`,
          },
          {
            label: 'Active commodities',
            value: String(activeCommodities),
            note: `${formatCurrency(outstandingCommodityBalance)} recorded value`,
          },
        ]}
      />
      <div className="admin-overview-bottom">
        <AdminPanel
          title="Contribution schedule"
          note="Based on current contribution plans"
          actions={<span className="admin-tag">Last 6 months</span>}
        >
          <div
            className="admin-schedule-bars"
            role="img"
            aria-label={trends
              .map((row) => `${row.label}: ${formatCurrency(row.savingsBasis)}`)
              .join('; ')}
          >
            {trends.map((row, index) => (
              <div key={row.period}>
                <span>{formatCurrency(row.savingsBasis)}</span>
                <i
                  data-current={index === trends.length - 1}
                  style={{ height: Math.max(4, (row.savingsBasis / maxScheduledSavings) * 130) }}
                />
                <small>{row.label.split(' ')[0]}</small>
              </div>
            ))}
          </div>
        </AdminPanel>
        <AdminPanel title="Scheduled fees" note="Last 6 months, not confirmed receipts">
          <div className="admin-fee-summary">
            <strong>{formatCurrency(totalFeeRevenue)}</strong>
            <dl>
              <div>
                <dt>Monthly charges</dt>
                <dd>{formatCurrency(totalChargesRevenue)}</dd>
              </div>
              <div>
                <dt>New member fees</dt>
                <dd>{formatCurrency(totalNewMemberFeeRevenue)}</dd>
              </div>
            </dl>
            <p>
              {currentNewMembers} new and {currentOldMembers} existing members in the current
              ledger. {formatCurrency(currentFees)} scheduled fees this month.
            </p>
          </div>
        </AdminPanel>
      </div>
      <AdminPanel
        title="Month by month"
        note="Scheduled contributions and fees"
        actions={
          canOpenAdminRoute('/dashboard/member-data', privilegeCodes) && <Link className="admin-inline-link" href="/dashboard/member-data">
            Member data
            <ArrowUpRight size={15} />
          </Link>
        }
      >
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  'Month',
                  'Registrations',
                  'New member fees',
                  'Monthly charges',
                  'Savings',
                  'Voucher total',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trends.map((row) => (
                <tr key={row.period}>
                  <td>{row.label}</td>
                  <td>{row.registrations}</td>
                  <td>{formatCurrency(row.newMemberFeeRevenue)}</td>
                  <td>{formatCurrency(row.chargeRevenue)}</td>
                  <td>{formatCurrency(row.savingsBasis)}</td>
                  <td>{formatCurrency(row.voucherTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>
      {canSwitchToMember && (
        <Link href="/dashboard?view=member" className="admin-inline-link">
          Switch to your member account
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  )
}
