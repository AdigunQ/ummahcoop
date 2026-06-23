'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ReceiptText,
  HandCoins,
  List,
  Menu,
  X,
  LogOut,
  FileText,
  PiggyBank,
  ScrollText,
  ArrowDownUp,
  ShoppingBag,
  ClipboardList,
  ShieldAlert,
  Settings,
  LineChart,
} from 'lucide-react'
import { UmmahLogo } from '@/components/brand/ummah-logo'
import { cn, getInitials } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { PRIVILEGE_CODES, type PrivilegeCode } from '@/lib/privileges'

interface NavProps {
  user: {
    id: string
    name: string | null
    email: string
    staffId?: string | null
    role: string
    status: string
    balance: number
    loanBalance: number
    privileges?: { code: string }[]
  }
  adminBadges?: {
    pendingMembers: number
    pendingPayments: number
    pendingLoans: number
  }
}

type BadgeKey = 'pending' | 'payments' | 'loans'

type NavItem = {
  href: string
  label: string
  icon: any
  badge?: BadgeKey
  group?: string
}

const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Main' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: LineChart, group: 'Main' },

  { href: '/dashboard/member-data', label: 'Member Data', icon: FileText, group: 'Members' },
  { href: '/dashboard/directory', label: 'Update Member', icon: Users, group: 'Members' },
  { href: '/dashboard/members', label: 'Approvals', icon: UserCheck, badge: 'pending', group: 'Members' },
  { href: '/dashboard/import-members', label: 'Import Members', icon: ClipboardList, group: 'Members' },
  { href: '/dashboard/admin-access', label: 'Admin Access', icon: ShieldAlert, group: 'Members' },

  { href: '/dashboard/payments', label: 'Payments', icon: ReceiptText, badge: 'payments', group: 'Operations' },
  { href: '/dashboard/withdrawals', label: 'Withdrawals', icon: ArrowDownUp, group: 'Operations' },
  { href: '/dashboard/commodity', label: 'Commodity', icon: ShoppingBag, group: 'Operations' },
  { href: '/dashboard/loans', label: 'Loans', icon: HandCoins, badge: 'loans', group: 'Operations' },

  { href: '/dashboard/vouchers', label: 'Reports', icon: ScrollText, group: 'Finance' },
  { href: '/dashboard/finance-report', label: 'Monthly Report', icon: ClipboardList, group: 'Finance' },
  { href: '/dashboard/transactions', label: 'Transactions', icon: List, group: 'Finance' },
]

const memberNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Account' },
  { href: '/dashboard/profile', label: 'Profile', icon: Settings, group: 'Account' },

  { href: '/dashboard/apply-loan', label: 'Apply for loan', icon: HandCoins, group: 'Actions' },
  { href: '/dashboard/withdrawals', label: 'Withdraw', icon: ArrowDownUp, group: 'Actions' },
  { href: '/dashboard/commodity', label: 'Commodity request', icon: ShoppingBag, group: 'Actions' },

  { href: '/dashboard/my-loans', label: 'My loans', icon: FileText, group: 'History' },
  { href: '/dashboard/history', label: 'Transactions', icon: PiggyBank, group: 'History' },
]

const privilegedNavItems: Array<NavItem & { privilege: PrivilegeCode }> = [
  { privilege: PRIVILEGE_CODES.VIEW_ANALYTICS, href: '/dashboard/analytics', label: 'Analytics', icon: LineChart, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.VIEW_MEMBER_DATA, href: '/dashboard/member-data', label: 'Member Data', icon: FileText, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.EDIT_MEMBERS, href: '/dashboard/directory', label: 'Update Member', icon: Users, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.APPROVE_MEMBERS, href: '/dashboard/members', label: 'Approvals', icon: UserCheck, badge: 'pending', group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.IMPORT_MEMBERS, href: '/dashboard/import-members', label: 'Import Members', icon: ClipboardList, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.REVIEW_PAYMENTS, href: '/dashboard/payments', label: 'Payments', icon: ReceiptText, badge: 'payments', group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.REVIEW_WITHDRAWALS, href: '/dashboard/withdrawals', label: 'Withdrawals', icon: ArrowDownUp, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.REVIEW_COMMODITY, href: '/dashboard/commodity?review=true', label: 'Commodity', icon: ShoppingBag, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.REVIEW_LOANS, href: '/dashboard/loans', label: 'Loans', icon: HandCoins, badge: 'loans', group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/vouchers', label: 'Reports', icon: ScrollText, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/finance-report', label: 'Monthly Report', icon: ClipboardList, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/transactions', label: 'Transactions', icon: List, group: 'Granted access' },
  { privilege: PRIVILEGE_CODES.MANAGE_ACCESS, href: '/dashboard/admin-access', label: 'Admin Access', icon: ShieldAlert, group: 'Granted access' },
]

function isGeneratedMemberEmail(email: string, staffId?: string | null) {
  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedEmail.endsWith('@internal.ummahcoop')) return true
  if (!staffId) return false
  const normalizedStaffId = staffId.trim().replace(/\s+/g, '').toLowerCase()

  return (
    normalizedEmail === `${normalizedStaffId}@faan-ummah.coop` ||
    normalizedEmail === `${normalizedStaffId}@ummahcoop.org` ||
    normalizedEmail.startsWith(`member-${normalizedStaffId}@`)
  )
}

export function DashboardNav({ user, adminBadges }: NavProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const privilegeCodes = new Set((user.privileges || []).map((privilege) => privilege.code))
  const hasGrantedAccess = privilegeCodes.size > 0
  const specialItems = user.role === 'ADMIN'
    ? []
    : privilegedNavItems.filter((item, index, list) => privilegeCodes.has(item.privilege) && list.findIndex((candidate) => candidate.href === item.href) === index)
  const navItems = user.role === 'ADMIN' ? adminNavItems : [...memberNavItems, ...specialItems]
  const badgeCounts = {
    pending: adminBadges?.pendingMembers ?? 0,
    payments: adminBadges?.pendingPayments ?? 0,
    loans: adminBadges?.pendingLoans ?? 0,
  } as const
  const displayEmail = user.role === 'MEMBER' && isGeneratedMemberEmail(user.email, user.staffId)
    ? 'Email not set'
    : user.email

  // group items
  const groups = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const key = item.group || 'Main'
    acc[key] = acc[key] || []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur-md lg:hidden"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <UmmahLogo
            markClassName="h-8 w-8"
            textClassName="text-sm text-foreground"
            compactText
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="mobile-menu-toggle"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-surface"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-72 border-r bg-surface transition-transform duration-300 ease-out',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex items-center justify-between border-b px-5 py-5" style={{ borderColor: 'rgb(var(--border))' }}>
            <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
              <UmmahLogo
                markClassName="h-9 w-9"
                textClassName="text-foreground"
                compactText
              />
            </Link>
            <ThemeToggle data-testid="sidebar-theme-toggle" />
          </div>

          {/* User summary (member) */}
          {user.role === 'MEMBER' && (
            <div className="border-b px-4 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
              <div
                className="flex items-center gap-3 rounded-xl border bg-surface-2 p-3"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user.name || 'Member'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{displayEmail}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div
                  className="rounded-lg border bg-surface px-3 py-2.5"
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Savings</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    ₦{user.balance.toLocaleString()}
                  </p>
                </div>
                <div
                  className="rounded-lg border bg-surface px-3 py-2.5"
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loan</p>
                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      user.loanBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                    }`}
                  >
                    ₦{user.loanBalance.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName} className="mb-5">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {groupName}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                          active
                            ? 'bg-accent/10 text-accent'
                            : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                        )}
                      >
                        {active && (
                          <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                        )}
                        <item.icon className="h-4 w-4 flex-none" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {(user.role === 'ADMIN' || hasGrantedAccess) && item.badge && badgeCounts[item.badge] > 0 && (
                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500/15 px-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            {badgeCounts[item.badge]}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t p-4" style={{ borderColor: 'rgb(var(--border))' }}>
            {user.role !== 'MEMBER' && (
              <div
                className="mb-3 flex items-center gap-3 rounded-xl border bg-surface-2 p-3"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user.role}</p>
                </div>
              </div>
            )}

            {user.role === 'MEMBER' && (
              <Link
                href="/dashboard/delete-account"
                onClick={() => setIsMobileMenuOpen(false)}
                data-testid="nav-delete-account"
                className={cn(
                  'mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === '/dashboard/delete-account'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
                )}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Close account</span>
              </Link>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              data-testid="nav-sign-out"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
