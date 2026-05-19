import type { ReactNode } from 'react'
import { BellRing, CreditCard, Landmark, Users } from 'lucide-react'
import { getCurrentMemberLiveDataset } from '@/lib/current-member-data'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { firstVoucherPeriodForCreatedAt, resolveVoucherPeriod } from '@/lib/vouchers'

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

export async function AdminAnalytics() {
  const now = new Date()
  const currentMonth = resolveVoucherPeriod().period
  const currentLabel = formatPeriodLabel(currentMonth)

  const [currentDataset, activeLoanAgg, queueCounts, trends] = await Promise.all([
    getCurrentMemberLiveDataset(currentMonth),
    prisma.loan.aggregate({
      where: { status: 'APPROVED', balance: { gt: 0 } },
      _count: { _all: true },
      _sum: { balance: true },
    }),
    Promise.all([
      prisma.user.count({ where: { role: 'MEMBER', status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.loan.count({ where: { status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    ]),
    Promise.all(
      Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)).map(
        async (startDate): Promise<TrendRow> => {
          const start = startDate
          const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
          const period = toPeriod(start)

          const [registrations, eligibleMembers] = await Promise.all([
            prisma.user.count({
              where: {
                role: 'MEMBER',
                createdAt: { gte: start, lt: end },
              },
            }),
            prisma.user.findMany({
              where: {
                role: 'MEMBER',
                status: 'ACTIVE',
                voucherEnabled: true,
                OR: [{ monthlyContribution: { gt: 0 } }, { specialContribution: { gt: 0 } }],
                createdAt: { lt: end },
              },
              select: {
                createdAt: true,
                monthlyContribution: true,
                specialContribution: true,
              },
            }),
          ])

          const included = eligibleMembers.filter((member) => firstVoucherPeriodForCreatedAt(member.createdAt) <= period)
          const newCount = included.filter((member) => firstVoucherPeriodForCreatedAt(member.createdAt) === period).length
          const oldCount = Math.max(0, included.length - newCount)
          const newMemberFeeRevenue = newCount * 1000
          const chargeRevenue = oldCount * 100
          const voucherFees = newMemberFeeRevenue + chargeRevenue
          const savingsBasis = included.reduce(
            (acc, member) => acc + (member.monthlyContribution || 0) + (member.specialContribution || 0),
            0
          )

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
        }
      )
    ),
  ])

  const [pendingMembers, pendingPayments, pendingLoans, pendingWithdrawals] = queueCounts
  const currentRows = currentDataset.rows
  const currentThriftSavings = sum(currentRows.map((row) => row.monthlySavings))
  const currentSpecialSavings = sum(currentRows.map((row) => row.specialSavings))
  const currentFees = sum(currentRows.map((row) => row.memberFee))
  const currentNewMembers = currentRows.filter((row) => row.memberType === 'NEW').length
  const currentOldMembers = currentRows.length - currentNewMembers
  const activeLoans = activeLoanAgg._count._all || 0
  const outstandingLoanBalance = activeLoanAgg._sum.balance || 0
  const pendingApprovals = pendingMembers + pendingPayments + pendingLoans + pendingWithdrawals

  const totalChargesRevenue = sum(trends.map((row) => row.chargeRevenue))
  const totalNewMemberFeeRevenue = sum(trends.map((row) => row.newMemberFeeRevenue))
  const totalFeeRevenue = totalChargesRevenue + totalNewMemberFeeRevenue

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Admin Analytics</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Account Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Clean snapshot of the cooperative with the current workbook month and fee revenue details side by side.
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            Current workbook: {currentLabel}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Members on record"
          value={currentRows.length.toLocaleString('en-NG')}
          icon={<Users className="h-4 w-4" />}
          accent="slate"
          caption={currentLabel}
        />
        <MetricCard
          label="Thrift savings"
          value={formatCurrency(currentThriftSavings)}
          icon={<Landmark className="h-4 w-4" />}
          accent="emerald"
          caption={currentLabel}
        />
        <MetricCard
          label="Special savings"
          value={formatCurrency(currentSpecialSavings)}
          icon={<Landmark className="h-4 w-4" />}
          accent="violet"
          caption={currentLabel}
        />
        <MetricCard
          label="Active loans"
          value={activeLoans.toLocaleString('en-NG')}
          icon={<CreditCard className="h-4 w-4" />}
          accent="violet"
          caption={formatCurrency(outstandingLoanBalance)}
        />
        <MetricCard
          label="Pending approvals"
          value={pendingApprovals.toLocaleString('en-NG')}
          icon={<BellRing className="h-4 w-4" />}
          accent="amber"
          caption="Members, payments, loans, withdrawals"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Charges revenue"
          value={formatCurrency(totalChargesRevenue)}
          icon={<CreditCard className="h-4 w-4" />}
          accent="slate"
          caption={`Up to ${currentLabel}`}
        />
        <MetricCard
          label="New member fee revenue"
          value={formatCurrency(totalNewMemberFeeRevenue)}
          icon={<Users className="h-4 w-4" />}
          accent="emerald"
          caption="1,000 per joining member"
        />
        <MetricCard
          label="Total fee revenue"
          value={formatCurrency(totalFeeRevenue)}
          icon={<Landmark className="h-4 w-4" />}
          accent="violet"
          caption="Charges + new member fees"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SnapshotCard
          title="Current Snapshot"
          subtitle={currentLabel}
          rows={currentRows.length}
          newMembers={currentNewMembers}
          oldMembers={currentOldMembers}
          fees={currentFees}
          thriftSavings={currentThriftSavings}
          specialSavings={currentSpecialSavings}
          footer="Derived from the current live workbook data."
        />

        <SnapshotCard
          title="Upcoming Voucher Snapshot"
          subtitle={currentLabel}
          rows={currentRows.length}
          newMembers={currentNewMembers}
          oldMembers={currentOldMembers}
          fees={currentFees}
          thriftSavings={currentThriftSavings}
          specialSavings={currentSpecialSavings}
          footer={`May stays at ${currentRows.length.toLocaleString('en-NG')} members until fresh registrations are added.`}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Trend Detail</h2>
            <p className="mt-1 text-sm text-slate-500">
              Last 6 months of registrations, charges revenue, new member fees, and savings basis.
            </p>
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Simple monthly pulse</span>
        </div>

        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-3">Month</th>
              <th className="px-6 py-3">Registrations</th>
              <th className="px-6 py-3">New Member Fee</th>
              <th className="px-6 py-3">Charges</th>
              <th className="px-6 py-3">Fee Revenue</th>
              <th className="px-6 py-3">Savings Basis</th>
              <th className="px-6 py-3">Voucher Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {trends.map((row) => (
              <tr key={row.period} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{row.label}</td>
                <td className="px-6 py-3 text-slate-700">{row.registrations.toLocaleString('en-NG')}</td>
                <td className="px-6 py-3 text-slate-900">{formatCurrency(row.newMemberFeeRevenue)}</td>
                <td className="px-6 py-3 text-slate-900">{formatCurrency(row.chargeRevenue)}</td>
                <td className="px-6 py-3 text-slate-900">{formatCurrency(row.voucherFees)}</td>
                <td className="px-6 py-3 text-slate-900">{formatCurrency(row.savingsBasis)}</td>
                <td className="px-6 py-3 font-semibold text-slate-900">{formatCurrency(row.voucherTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  caption,
  icon,
  accent,
}: {
  label: string
  value: string
  caption: string
  icon: ReactNode
  accent: 'slate' | 'emerald' | 'violet' | 'amber'
}) {
  const accentStyles = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accentStyles[accent]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{caption}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-2.5 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  )
}

function SnapshotCard({
  title,
  subtitle,
  rows,
  newMembers,
  oldMembers,
  thriftSavings,
  specialSavings,
  fees,
  footer,
}: {
  title: string
  subtitle: string
  rows: number
  newMembers: number
  oldMembers: number
  thriftSavings: number
  specialSavings: number
  fees: number
  footer: string
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Rows</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{rows.toLocaleString('en-NG')}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DetailStat label="New / Old" value={`${newMembers} / ${oldMembers}`} />
        <DetailStat label="Thrift Savings" value={formatCurrency(thriftSavings)} />
        <DetailStat label="Special Savings" value={formatCurrency(specialSavings)} />
        <DetailStat label="Fees" value={formatCurrency(fees)} />
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{footer}</p>
    </section>
  )
}

function DetailStat({ label, value, subdued }: { label: string; value: string; subdued?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${subdued ? 'text-slate-500' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
