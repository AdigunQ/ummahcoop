'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  HandCoins,
  PackageSearch,
  Landmark,
  FileText,
  PiggyBank,
  TrendingUp,
  Wallet,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { LOAN_POLICY } from '@/lib/constants'

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
  recentPayments: any[]
  recentLoans: any[]
  recentCommodities: {
    id: string
    itemCategory: string | null
    itemModel: string | null
    status: string
    createdAt: string | Date
  }[]
}

export function MemberDashboard({
  isPrivileged = false,
  user,
  loanEligibility,
  loanSummary,
  commoditySummary,
  recentPayments,
  recentLoans,
  recentCommodities,
}: MemberDashboardProps) {
  const isPending = user.status === 'PENDING'

  if (isPending) {
    return (
      <div className="card relative overflow-hidden p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-transparent" />
        <div className="relative mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Account pending approval</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Your membership request is being reviewed by an administrator.
            Your dashboard will activate as soon as it is approved.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border bg-surface-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            style={{ borderColor: 'rgb(var(--border))' }}>
            <BadgeCheck className="h-3.5 w-3.5 text-amber-500" />
            Review in progress
          </div>
        </div>
      </div>
    )
  }

  const memberSince = formatMonthYear(user.createdAt)
  const firstName = user.name?.split(' ')[0] || 'Member'
  const monthlyPlan = user.monthlyContribution || 0
  const specialPlan = user.specialContribution || 0
  const approvedLoanCount = loanSummary.approvedCount || 0
  const approvedLoanAmount = loanSummary.approvedAmount || 0
  const loanPaidAmount = loanSummary.paidAmount || 0
  const loanOutstandingAmount = loanSummary.outstandingAmount || 0
  const staffId = user.staffId || 'N/A'
  const department = user.department || 'N/A'
  const totalBalance = user.balance + user.specialBalance

  return (
    <div className="space-y-6">
      {/* Hero / overview */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-transparent" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="label-eyebrow">Member portal</p>
              {isPrivileged && (
                <Link
                  href="/dashboard"
                  data-testid="switch-to-admin-view"
                  className="inline-flex items-center rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
                >
                  Switch to admin view
                </Link>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Here is a clear snapshot of your savings, loans, and contribution plan.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Chip icon={CalendarDays} label={`Since ${memberSince}`} />
              <Chip icon={BadgeCheck} label={user.status} tone="success" />
              <Chip icon={Building2} label={department} />
              <Chip icon={Landmark} label={`ID · ${staffId}`} />
            </div>
          </div>

          <div
            className="rounded-2xl border bg-surface-2 p-5"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <div className="flex items-center justify-between">
              <p className="label-eyebrow">Total balance</p>
              <span className="pill bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                Active
              </span>
            </div>
            <p className="mt-3 text-4xl font-semibold tracking-tight">{formatCurrency(totalBalance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Across thrift and special savings</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div
                className="rounded-xl border bg-surface px-3 py-2.5"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loan</p>
                <p
                  className={`mt-1 text-base font-semibold ${
                    user.loanBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                  }`}
                >
                  {formatCurrency(user.loanBalance)}
                </p>
              </div>
              <div
                className="rounded-xl border bg-surface px-3 py-2.5"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Eligible</p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatCurrency(loanEligibility)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Thrift savings" value={formatCurrency(user.balance)} icon={PiggyBank} tone="emerald" />
        <MetricCard title="Special savings" value={formatCurrency(user.specialBalance)} icon={Wallet} tone="indigo" />
        <MetricCard title="Total contributed" value={formatCurrency(user.totalContributions)} icon={Landmark} tone="slate" />
        <MetricCard title="Loan outstanding" value={formatCurrency(loanOutstandingAmount)} icon={HandCoins} tone="amber" />
        <MetricCard title="Commodity balance" value={formatCurrency(commoditySummary.commodityOutstanding)} icon={PackageSearch} tone="indigo" />
      </div>

      {/* 3-column detail */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="Savings plan" eyebrow="Monthly schedule">
          <div className="space-y-3">
            <DetailLine label="Thrift contribution" value={formatCurrency(monthlyPlan)} />
            <DetailLine label="Special contribution" value={formatCurrency(specialPlan)} />
            <DetailLine label="Loan eligibility" value={formatCurrency(loanEligibility)} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Loan limit is calculated as a multiple of your current savings balance,
            per cooperative policy.
          </p>
        </PanelCard>

        <PanelCard title="Loan summary" eyebrow="Borrowing">
          <div className="space-y-3">
            <DetailLine label="Approved loans" value={`${approvedLoanCount}`} />
            <DetailLine label="Loans collected" value={formatCurrency(approvedLoanAmount)} />
            <DetailLine label="Paid so far" value={formatCurrency(loanPaidAmount)} />
            <DetailLine label="Outstanding" value={formatCurrency(loanOutstandingAmount)} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Paid from monthly deductions starting {loanSummary.repaymentStartPeriod || 'the first recorded deduction'}.
          </p>
        </PanelCard>

        <PanelCard title="Commodity summary" eyebrow="Repayment tracking">
          <div className="space-y-3">
            <DetailLine label="Commodity collected" value={formatCurrency(commoditySummary.commodityCollected)} />
            <DetailLine label="Paid so far" value={formatCurrency(commoditySummary.commodityPaid)} />
            <DetailLine label="Outstanding" value={formatCurrency(commoditySummary.commodityOutstanding)} />
            <DetailLine label="Facilities" value={`${commoditySummary.commodityCount}`} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Paid from monthly deductions starting {commoditySummary.commodityRepaymentStartPeriod || 'the first recorded deduction'}.
          </p>
        </PanelCard>

        <PanelCard title="Quick actions" eyebrow="Shortcuts">
          <div className="space-y-2.5">
            <QuickActionCard
              href="/dashboard/apply-loan"
              title="Request loan"
              description={`Up to ${formatCurrency(loanEligibility)}`}
              icon={HandCoins}
              disabled={loanEligibility < LOAN_POLICY.minAmount || user.loanBalance > 0}
            />
            <QuickActionCard
              href="/api/member-statement/export"
              title="Download statement (CSV)"
              description="Includes savings, loan and commodity history"
              icon={FileText}
            />
            <QuickActionCard
              href="/dashboard/commodity"
              title="Track commodity requests"
              description="Submit and view request updates"
              icon={PackageSearch}
            />
            <QuickActionCard
              href="/dashboard/history"
              title="Transaction history"
              description="See your activity"
              icon={ArrowUpRight}
            />
          </div>
        </PanelCard>
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="Recent payments" eyebrow="Activity" padded={false}>
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {recentPayments.length === 0 ? (
              <EmptyState icon={AlertCircle} text="No payments yet" />
            ) : (
              recentPayments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold capitalize">
                      {String(payment.type).toLowerCase().replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.date || payment.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold">{formatCurrency(payment.amount)}</p>
                    <StatusPill status={payment.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard title="Recent loans" eyebrow="Borrowing history" padded={false}>
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {recentLoans.length === 0 && approvedLoanCount === 0 ? (
              <EmptyState icon={CheckCircle2} text="No loans yet" />
            ) : recentLoans.length === 0 ? (
              <div className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Imported ledger loan</p>
                    <p className="text-xs text-muted-foreground">Current collected amount</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold">{formatCurrency(approvedLoanAmount)}</p>
                    <StatusPill status="APPROVED" />
                  </div>
                </div>
              </div>
            ) : (
              recentLoans.slice(0, 5).map((loan) => (
                <div key={loan.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold capitalize">{loan.purpose}</p>
                    <p className="text-xs text-muted-foreground">{loan.duration} months</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold">{formatCurrency(loan.amount)}</p>
                    <StatusPill status={loan.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard title="Commodity tracking" eyebrow="Requests" padded={false}>
          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {recentCommodities.length === 0 && commoditySummary.commodityCount === 0 ? (
              <EmptyState icon={PackageSearch} text="No commodity requests yet" />
            ) : recentCommodities.length === 0 ? (
              <div className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Imported ledger commodity</p>
                    <p className="text-xs text-muted-foreground">Current collected amount</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold">{formatCurrency(commoditySummary.commodityCollected)}</p>
                    <StatusPill status="APPROVED" />
                  </div>
                </div>
              </div>
            ) : (
              recentCommodities.map((request) => (
                <div key={request.id} className="px-5 py-3.5">
                  <div className="truncate text-sm font-semibold text-gray-900">{request.itemCategory || 'Commodity request'}</div>
                  <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)} · {request.itemModel || 'No details'}</p>
                  <div className="mt-2">
                    <StatusPill status={request.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>
      </div>
    </div>
  )
}

function formatMonthYear(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })
}

function PanelCard({
  title,
  eyebrow,
  children,
  padded = true,
}: {
  title: string
  eyebrow: string
  children: ReactNode
  padded?: boolean
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b px-5 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
        <p className="label-eyebrow">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  icon: any
  tone: 'emerald' | 'amber' | 'indigo' | 'slate'
}) {
  const tones: Record<typeof tone, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  }

  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-eyebrow">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border bg-surface-2 px-4 py-3"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

function Chip({
  icon: Icon,
  label,
  tone = 'neutral',
}: {
  icon: any
  label: string
  tone?: 'neutral' | 'success'
}) {
  const tones = {
    neutral: 'border-border bg-surface-2 text-muted-foreground',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
      style={{ borderColor: tone === 'success' ? undefined : 'rgb(var(--border))' }}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
  disabled,
}: {
  href: string
  title: string
  description: string
  icon: any
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border bg-surface-2 p-3.5 opacity-60"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-surface text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">Build savings to unlock</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={href}
      data-testid={`quick-action-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className="group flex items-start gap-3 rounded-xl border bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:border-ring/40"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
    </Link>
  )
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styleMap: Record<string, string> = {
    APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    REJECTED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    FAILED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        styleMap[status] || 'bg-surface-2 text-muted-foreground'
      }`}
    >
      {status}
    </span>
  )
}
