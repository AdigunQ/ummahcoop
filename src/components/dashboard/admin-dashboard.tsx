'use client'

import Link from 'next/link'
import {
  Users,
  Landmark,
  HandCoins,
  BellRing,
  Clock3,
  ArrowUpRight,
  ReceiptText,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface AdminDashboardProps {
  stats: {
    totalMembers: number
    totalSavings: number
    activeLoans: number
    pendingApprovals: number
    pendingMembers: number
    pendingPayments: number
    pendingLoans: number
  }
  recentTransactions: any[]
}

export function AdminDashboard({ stats, recentTransactions }: AdminDashboardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)] sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-52 w-52 rounded-full bg-blue-300/25 blur-3xl" />

      <div className="relative mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operations Console</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Workbook-backed member visibility, approvals, and risk controls in one view.</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
          <Clock3 className="h-4 w-4 text-cyan-700" />
          Current workbook snapshot
        </div>
      </div>

      <div className="relative mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Members"
          value={stats.totalMembers.toString()}
          icon={Users}
          tone="slate"
        />
        <MetricCard
          title="Total Savings"
          value={formatCurrency(stats.totalSavings)}
          icon={Landmark}
          tone="emerald"
        />
        <MetricCard
          title="Active Loans"
          value={stats.activeLoans.toString()}
          icon={HandCoins}
          tone="violet"
        />
        <MetricCard
          title="Pending Approvals"
          value={stats.pendingApprovals.toString()}
          icon={BellRing}
          tone="amber"
          pulse={stats.pendingApprovals > 0}
        />
      </div>

      {stats.pendingApprovals > 0 && (
        <div className="relative mb-8 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-5">
          <div className="mb-4 flex items-center gap-2 text-amber-900">
            <BellRing className="h-4 w-4" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em]">Priority Queue</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {stats.pendingMembers > 0 && (
              <ActionTile
                href="/dashboard/members"
                value={stats.pendingMembers}
                label="Member Approvals"
              />
            )}
            {stats.pendingPayments > 0 && (
              <ActionTile
                href="/dashboard/payments"
                value={stats.pendingPayments}
                label="Payment Verifications"
              />
            )}
            {stats.pendingLoans > 0 && (
              <ActionTile
                href="/dashboard/loans"
                value={stats.pendingLoans}
                label="Loan Requests"
              />
            )}
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">Recent Activity</h2>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <ReceiptText className="h-4 w-4" />
            Last 10 transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead className="bg-slate-100/80">
              <tr>
                <TableHead label="Date" />
                <TableHead label="Member" />
                <TableHead label="Type" />
                <TableHead label="Amount" />
                <TableHead label="Status" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentTransactions.map((transaction) => (
                <tr key={transaction.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-5 py-4 text-sm text-slate-700">{formatDate(transaction.createdAt)}</td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-900">{transaction.user?.name || 'Unknown'}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                      {transaction.type.toLowerCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{formatCurrency(transaction.amount)}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={transaction.status} />
                  </td>
                </tr>
              ))}

              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    No recent transactions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
  pulse,
}: {
  title: string
  value: string
  icon: any
  tone: 'slate' | 'emerald' | 'violet' | 'amber'
  pulse?: boolean
}) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-700',
    emerald: 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700',
    violet: 'border-violet-200/70 bg-violet-50/70 text-violet-700',
    amber: 'border-amber-200/70 bg-amber-50/70 text-amber-700',
  }

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className="relative rounded-xl bg-white/80 p-2.5 shadow-sm">
          <Icon className="h-5 w-5" />
          {pulse && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />}
        </div>
      </div>
    </div>
  )
}

function ActionTile({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-white bg-white/80 px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
    >
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-600">{label}</p>
      </div>
      <ArrowUpRight className="h-5 w-5 text-slate-400 transition-colors group-hover:text-slate-700" />
    </Link>
  )
}

function TableHead({ label }: { label: string }) {
  return (
    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
    </th>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: 'border-amber-200 bg-amber-100 text-amber-900',
    COMPLETED: 'border-emerald-200 bg-emerald-100 text-emerald-900',
    FAILED: 'border-rose-200 bg-rose-100 text-rose-900',
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${styles[status as keyof typeof styles] || 'border-slate-200 bg-slate-100 text-slate-700'}`}
    >
      {status.toLowerCase()}
    </span>
  )
}
