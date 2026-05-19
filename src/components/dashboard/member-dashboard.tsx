'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle,
  Clock,
  HandCoins,
  Landmark,
  PiggyBank,
  Sparkles,
  Wallet,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { LOAN_POLICY } from '@/lib/constants'

interface MemberDashboardProps {
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
  }
  recentPayments: any[]
  recentLoans: any[]
}

export function MemberDashboard({
  user,
  loanEligibility,
  loanSummary,
  recentPayments,
  recentLoans,
}: MemberDashboardProps) {
  const isPending = user.status === 'PENDING'

  if (isPending) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-40 w-40 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-2xl text-center">
          <Clock className="mx-auto mb-4 h-14 w-14 text-amber-700" />
          <h1 className="text-3xl font-bold tracking-tight text-amber-950">Account Pending Approval</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-amber-900/80">
            Your membership request is in the admin queue. Once approved, your savings, loan history, and member
            profile will appear here automatically.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
            <BadgeCheck className="h-4 w-4" />
            Private review in progress
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
  const staffId = user.staffId || 'N/A'
  const department = user.department || 'N/A'

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-900/15 bg-[#0f1c15] text-[#f6f2ea] shadow-[0_28px_90px_rgba(7,19,13,0.28)]">
        <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-[#8bd49d]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-[#ffd38a]/12 blur-3xl" />

        <div className="relative grid gap-6 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-7 lg:py-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c6d7c7] backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#8bd49d]" />
              Member portal
            </div>

            <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#ccd9cd] sm:text-base">
              Your cooperative account is private, approved, and easy to follow. Savings, loans, and contribution plans
              are summarized here in one clean view.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Chip icon={CalendarDays} label={`Member since ${memberSince}`} tone="emerald" />
              <Chip icon={BadgeCheck} label={user.status} tone="slate" />
              <Chip icon={Building2} label={department} tone="gold" />
              <Chip icon={Landmark} label={`Staff ID ${staffId}`} tone="forest" />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8bd49d]">Account snapshot</p>
            <div className="mt-4 space-y-3">
              <SnapshotRow label="Thrift savings" value={formatCurrency(user.balance)} />
              <SnapshotRow label="Special savings" value={formatCurrency(user.specialBalance)} />
              <SnapshotRow label="Total contributions" value={formatCurrency(user.totalContributions)} />
              <SnapshotRow label="Outstanding loan" value={formatCurrency(user.loanBalance)} />
              <SnapshotRow label="Approved loans" value={`${approvedLoanCount} · ${formatCurrency(approvedLoanAmount)}`} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Thrift Savings" value={formatCurrency(user.balance)} icon={PiggyBank} tone="emerald" />
        <MetricCard title="Special Savings" value={formatCurrency(user.specialBalance)} icon={Wallet} tone="violet" />
        <MetricCard title="Total Contributions" value={formatCurrency(user.totalContributions)} icon={Landmark} tone="slate" />
        <MetricCard title="Loan Balance" value={formatCurrency(user.loanBalance)} icon={HandCoins} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PanelCard title="Savings plan" eyebrow="Contribution detail">
          <div className="space-y-4">
            <DetailLine label="Monthly thrift plan" value={formatCurrency(monthlyPlan)} />
            <DetailLine label="Special savings plan" value={formatCurrency(specialPlan)} />
            <DetailLine label="Loan eligibility" value={formatCurrency(loanEligibility)} />
            <p className="text-xs leading-6 text-slate-500">
              Your eligible loan limit is based on your current savings balance and the cooperative loan policy.
            </p>
          </div>
        </PanelCard>

        <PanelCard title="Loan summary" eyebrow="Current borrowing">
          <div className="space-y-4">
            <DetailLine label="Approved loans" value={`${approvedLoanCount}`} />
            <DetailLine label="Approved amount" value={formatCurrency(approvedLoanAmount)} />
            <DetailLine label="Outstanding balance" value={formatCurrency(user.loanBalance)} />
            <p className="text-xs leading-6 text-slate-500">
              Loan requests are private and reviewed inside the admin portal before any disbursement.
            </p>
          </div>
        </PanelCard>

        <PanelCard title="Quick actions" eyebrow="Member tools">
          <div className="space-y-3">
            <QuickActionCard
              href="/dashboard/apply-loan"
              title="Request loan"
              description={`Eligible up to ${formatCurrency(loanEligibility)}`}
              icon={HandCoins}
              disabled={loanEligibility < LOAN_POLICY.minAmount || user.loanBalance > 0}
            />
            <QuickActionCard
              href="/dashboard/history"
              title="Transaction history"
              description="Review your member activity"
              icon={ArrowUpRight}
            />
          </div>
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelCard title="Recent payments" eyebrow="Latest activity" padded={false}>
          <div className="divide-y divide-slate-200">
            {recentPayments.length === 0 ? (
              <EmptyState icon={AlertCircle} text="No payments yet" />
            ) : (
              recentPayments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-900">
                      {String(payment.type).toLowerCase().replace('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(payment.date || payment.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
                    <StatusPill status={payment.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard title="Recent loans" eyebrow="Borrowing history" padded={false}>
          <div className="divide-y divide-slate-200">
            {recentLoans.length === 0 ? (
              <EmptyState icon={CheckCircle} text="No loans yet" />
            ) : (
              recentLoans.slice(0, 5).map((loan) => (
                <div key={loan.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-900">{loan.purpose}</p>
                    <p className="text-xs text-slate-500">{loan.duration} months</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(loan.amount)}</p>
                    <StatusPill status={loan.status} />
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
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleDateString('en-NG', {
    month: 'short',
    year: 'numeric',
  })
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
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
      </div>
      <div className={padded ? 'px-5 py-5' : ''}>{children}</div>
    </section>
  )
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#a7b7aa]">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
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
  tone: 'emerald' | 'amber' | 'violet' | 'slate'
}) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-2.5 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function Chip({
  icon: Icon,
  label,
  tone,
}: {
  icon: any
  label: string
  tone: 'emerald' | 'slate' | 'gold' | 'forest'
}) {
  const tones = {
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-[#bff1c9]',
    slate: 'border-white/10 bg-white/5 text-[#dbe7dc]',
    gold: 'border-[#ffd38a]/30 bg-[#ffd38a]/10 text-[#ffe7b9]',
    forest: 'border-[#8bd49d]/25 bg-[#8bd49d]/10 text-[#d7f6de]',
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${tones[tone]}`}>
      <Icon className="h-3.5 w-3.5" />
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
      <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 opacity-60">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <Icon className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">Increase savings to unlock</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="rounded-lg bg-slate-100 p-2.5">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-slate-400 transition-colors group-hover:text-slate-700" />
    </Link>
  )
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="px-5 py-8 text-center text-slate-500">
      <Icon className="mx-auto mb-2 h-10 w-10 text-slate-300" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styleMap: Record<string, string> = {
    APPROVED: 'border-emerald-200 bg-emerald-100 text-emerald-900',
    PENDING: 'border-amber-200 bg-amber-100 text-amber-900',
    COMPLETED: 'border-blue-200 bg-blue-100 text-blue-900',
    REJECTED: 'border-rose-200 bg-rose-100 text-rose-900',
    FAILED: 'border-rose-200 bg-rose-100 text-rose-900',
  }

  return (
    <span
      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        styleMap[status] || 'border-slate-200 bg-slate-100 text-slate-700'
      }`}
    >
      {status}
    </span>
  )
}
