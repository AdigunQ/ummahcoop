import type { ReactNode } from 'react'
import { BellRing, CreditCard, Landmark, TrendingUp, Users, Wallet } from 'lucide-react'
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
      {/* Hero */}
      <section className="card relative overflow-hidden p-6 sm:p-7">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-eyebrow">Admin · Overview</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">Cooperative analytics</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              A focused snapshot of the cooperative's current workbook month, members,
              fees, and loan exposure.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-2 self-start rounded-full border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted-foreground"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Workbook · {currentLabel}
          </div>
        </div>
      </section>

      {/* Top metric grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Members on record"
          value={currentRows.length.toLocaleString('en-NG')}
          icon={<Users className="h-5 w-5" />}
          tone="slate"
          caption={currentLabel}
        />
        <MetricCard
          label="Thrift savings"
          value={formatCurrency(currentThriftSavings)}
          icon={<Landmark className="h-5 w-5" />}
          tone="emerald"
          caption={currentLabel}
        />
        <MetricCard
          label="Special savings"
          value={formatCurrency(currentSpecialSavings)}
          icon={<Wallet className="h-5 w-5" />}
          tone="indigo"
          caption={currentLabel}
        />
        <MetricCard
          label="Active loans"
          value={activeLoans.toLocaleString('en-NG')}
          icon={<CreditCard className="h-5 w-5" />}
          tone="amber"
          caption={formatCurrency(outstandingLoanBalance)}
        />
        <MetricCard
          label="Pending approvals"
          value={pendingApprovals.toLocaleString('en-NG')}
          icon={<BellRing className="h-5 w-5" />}
          tone="rose"
          caption="Across all queues"
        />
      </div>

      {/* Revenue group */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Charges revenue"
          value={formatCurrency(totalChargesRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="slate"
          caption={`Up to ${currentLabel}`}
        />
        <MetricCard
          label="New member fees"
          value={formatCurrency(totalNewMemberFeeRevenue)}
          icon={<Users className="h-5 w-5" />}
          tone="emerald"
          caption="₦1,000 per joining member"
        />
        <MetricCard
          label="Total fee revenue"
          value={formatCurrency(totalFeeRevenue)}
          icon={<Landmark className="h-5 w-5" />}
          tone="indigo"
          caption="Charges + new fees"
        />
      </div>

      {/* Snapshots */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SnapshotCard
          title="Current snapshot"
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
          title="Upcoming voucher"
          subtitle={currentLabel}
          rows={currentRows.length}
          newMembers={currentNewMembers}
          oldMembers={currentOldMembers}
          fees={currentFees}
          thriftSavings={currentThriftSavings}
          specialSavings={currentSpecialSavings}
          footer={`Stays at ${currentRows.length.toLocaleString('en-NG')} members until fresh registrations arrive.`}
        />
      </div>

      {/* Trend table */}
      <section className="card overflow-hidden">
        <div className="flex items-end justify-between gap-4 border-b px-6 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            <p className="label-eyebrow">Trend</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Last 6 months</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Registrations, charges, new member fees, and savings basis.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground" style={{ borderColor: 'rgb(var(--border))' }}>
                <th className="px-6 py-3 font-semibold">Month</th>
                <th className="px-6 py-3 font-semibold">Registrations</th>
                <th className="px-6 py-3 font-semibold">New member</th>
                <th className="px-6 py-3 font-semibold">Charges</th>
                <th className="px-6 py-3 font-semibold">Fees</th>
                <th className="px-6 py-3 font-semibold">Savings</th>
                <th className="px-6 py-3 font-semibold">Voucher total</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {trends.map((row) => (
                <tr key={row.period} className="transition-colors hover:bg-surface-2">
                  <td className="px-6 py-3.5 font-medium">{row.label}</td>
                  <td className="px-6 py-3.5 text-muted-foreground">{row.registrations.toLocaleString('en-NG')}</td>
                  <td className="px-6 py-3.5">{formatCurrency(row.newMemberFeeRevenue)}</td>
                  <td className="px-6 py-3.5">{formatCurrency(row.chargeRevenue)}</td>
                  <td className="px-6 py-3.5">{formatCurrency(row.voucherFees)}</td>
                  <td className="px-6 py-3.5 text-muted-foreground">{formatCurrency(row.savingsBasis)}</td>
                  <td className="px-6 py-3.5 font-semibold">{formatCurrency(row.voucherTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string
  value: string
  caption: string
  icon: ReactNode
  tone: 'slate' | 'emerald' | 'indigo' | 'amber' | 'rose'
}) {
  const tones: Record<typeof tone, string> = {
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  }

  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-eyebrow">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tones[tone]}`}>
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
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">{subtitle}</p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="text-right">
          <p className="label-eyebrow">Rows</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{rows.toLocaleString('en-NG')}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DetailStat label="New / Old" value={`${newMembers} / ${oldMembers}`} />
        <DetailStat label="Fees" value={formatCurrency(fees)} />
        <DetailStat label="Thrift" value={formatCurrency(thriftSavings)} />
        <DetailStat label="Special" value={formatCurrency(specialSavings)} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{footer}</p>
    </section>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border bg-surface-2 px-4 py-3"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <p className="label-eyebrow">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}
