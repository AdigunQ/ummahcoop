'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
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
  ChevronRight,
  Search,
  ShieldCheck,
  CircleUserRound,
  CalendarDays,
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
    privileges?: { code: string }[]
  }
  adminBadges?: {
    pendingMembers: number
    pendingPayments: number
    pendingLoans: number
    pendingSavingsChanges?: number
  }
}

type BadgeKey = 'pending' | 'payments' | 'loans' | 'savings'

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
  { href: '/dashboard/directory', label: 'Member directory', icon: Users, group: 'Members' },
  { href: '/dashboard/savings-changes', label: 'Savings changes', icon: PiggyBank, badge: 'savings', group: 'Members' },
  {
    href: '/dashboard/members',
    label: 'Approvals',
    icon: UserCheck,
    badge: 'pending',
    group: 'Members',
  },
  {
    href: '/dashboard/import-members',
    label: 'Import Members',
    icon: ClipboardList,
    group: 'Members',
  },
  { href: '/dashboard/admin-access', label: 'Admin Access', icon: ShieldAlert, group: 'Members' },

  {
    href: '/dashboard/payments',
    label: 'Payments',
    icon: ReceiptText,
    badge: 'payments',
    group: 'Operations',
  },
  { href: '/dashboard/withdrawals', label: 'Withdrawals', icon: ArrowDownUp, group: 'Operations' },
  { href: '/dashboard/commodity', label: 'Commodity', icon: ShoppingBag, group: 'Operations' },
  {
    href: '/dashboard/loans',
    label: 'Loans',
    icon: HandCoins,
    badge: 'loans',
    group: 'Operations',
  },

  { href: '/dashboard/vouchers', label: 'Reports', icon: ScrollText, group: 'Finance' },
  {
    href: '/dashboard/finance-report',
    label: 'Monthly Report',
    icon: ClipboardList,
    group: 'Finance',
  },
  { href: '/dashboard/transactions', label: 'Transactions', icon: List, group: 'Finance' },
  { href: '/dashboard/month-end', label: 'Month end', icon: CalendarDays, group: 'Finance' },
]

const memberNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Account' },
  { href: '/dashboard/profile', label: 'Profile', icon: Settings, group: 'Account' },
  { href: '/dashboard/savings-changes', label: 'Change savings', icon: PiggyBank, group: 'Actions' },

  { href: '/dashboard/apply-loan', label: 'Apply for loan', icon: HandCoins, group: 'Actions' },
  { href: '/dashboard/withdrawals', label: 'Withdraw', icon: ArrowDownUp, group: 'Actions' },
  { href: '/dashboard/commodity', label: 'Commodity request', icon: ShoppingBag, group: 'Actions' },

  { href: '/dashboard/my-loans', label: 'My loans', icon: FileText, group: 'History' },
  { href: '/dashboard/history', label: 'Transactions', icon: PiggyBank, group: 'History' },
]

const privilegedNavItems: Array<NavItem & { privilege: PrivilegeCode }> = [
  { privilege: PRIVILEGE_CODES.EDIT_MEMBERS, href: '/dashboard/savings-changes', label: 'Savings changes', icon: PiggyBank, badge: 'savings', group: 'Administration' },
  {
    privilege: PRIVILEGE_CODES.VIEW_ANALYTICS,
    href: '/dashboard/analytics',
    label: 'Analytics',
    icon: LineChart,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.VIEW_MEMBER_DATA,
    href: '/dashboard/member-data',
    label: 'Member Data',
    icon: FileText,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.EDIT_MEMBERS,
    href: '/dashboard/directory',
    label: 'Member directory',
    icon: Users,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.APPROVE_MEMBERS,
    href: '/dashboard/members',
    label: 'Approvals',
    icon: UserCheck,
    badge: 'pending',
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.IMPORT_MEMBERS,
    href: '/dashboard/import-members',
    label: 'Import Members',
    icon: ClipboardList,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.REVIEW_PAYMENTS,
    href: '/dashboard/payments',
    label: 'Payments',
    icon: ReceiptText,
    badge: 'payments',
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.REVIEW_WITHDRAWALS,
    href: '/dashboard/withdrawals',
    label: 'Withdrawals',
    icon: ArrowDownUp,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.REVIEW_COMMODITY,
    href: '/dashboard/commodity?review=true',
    label: 'Commodity',
    icon: ShoppingBag,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.REVIEW_LOANS,
    href: '/dashboard/loans',
    label: 'Loans',
    icon: HandCoins,
    badge: 'loans',
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.VIEW_FINANCE,
    href: '/dashboard/vouchers',
    label: 'Reports',
    icon: ScrollText,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.VIEW_FINANCE,
    href: '/dashboard/finance-report',
    label: 'Monthly Report',
    icon: ClipboardList,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.VIEW_FINANCE,
    href: '/dashboard/transactions',
    label: 'Transactions',
    icon: List,
    group: 'Administration',
  },
  {
    privilege: PRIVILEGE_CODES.MANAGE_ACCESS,
    href: '/dashboard/admin-access',
    label: 'Admin Access',
    icon: ShieldAlert,
    group: 'Administration',
  },
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
  const searchParams = useSearchParams()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const privilegeCodes = new Set((user.privileges || []).map((p) => p.code))
  const hasGrantedAccess = user.role === 'MEMBER' && privilegeCodes.size > 0
  const personalRoutes = [
    '/dashboard/profile',
    '/dashboard/apply-loan',
    '/dashboard/my-loans',
    '/dashboard/history',
    '/dashboard/delete-account',
  ]
  const isMemberView =
    user.role === 'MEMBER' &&
    (!hasGrantedAccess ||
      searchParams.get('view') === 'member' ||
      personalRoutes.includes(pathname) ||
      (pathname === '/dashboard/commodity' && searchParams.get('review') !== 'true'))
  const specialItems = privilegedNavItems.filter((item) => privilegeCodes.has(item.privilege))
  const navItems =
    user.role === 'ADMIN'
      ? adminNavItems
      : isMemberView
        ? memberNavItems
        : [
            { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
            ...specialItems,
          ]
  const badgeCounts = {
    pending: adminBadges?.pendingMembers ?? 0,
    payments: adminBadges?.pendingPayments ?? 0,
    loans: adminBadges?.pendingLoans ?? 0,
    savings: adminBadges?.pendingSavingsChanges ?? 0,
  }
  const adminGroups: Record<string, string> = {
    '/dashboard': 'Workspace',
    '/dashboard/analytics': 'Workspace',
    '/dashboard/member-data': 'Members & data',
    '/dashboard/directory': 'Members & data',
    '/dashboard/members': 'Members & data',
    '/dashboard/savings-changes': 'Requests',
    '/dashboard/import-members': 'Members & data',
    '/dashboard/payments': 'Requests',
    '/dashboard/withdrawals': 'Requests',
    '/dashboard/commodity': 'Requests',
    '/dashboard/loans': 'Requests',
    '/dashboard/vouchers': 'Finance',
    '/dashboard/finance-report': 'Finance',
    '/dashboard/transactions': 'Finance',
    '/dashboard/month-end': 'Finance',
    '/dashboard/admin-access': 'Settings',
  }
  const groupedItems = isMemberView
    ? navItems
    : navItems.map((item) => ({
        ...item,
        group: adminGroups[item.href.split('?')[0]] || 'Settings',
      }))
  const groups = groupedItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    ;(acc[item.group || 'Workspace'] ||= []).push(item)
    return acc
  }, {})
  const currentItem = navItems.find((item) => pathname === item.href.split('?')[0])
  const pageName =
    currentItem?.label || (pathname.includes('/directory/') ? 'Member profile' : 'Account')
  const canFindMember =
    user.role === 'ADMIN' || (!isMemberView && privilegeCodes.has(PRIVILEGE_CODES.EDIT_MEMBERS))
  const memberHref = (href: string) =>
    hasGrantedAccess && isMemberView ? `${href}${href.includes('?') ? '&' : '?'}view=member` : href

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname, searchParams])
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) setIsMobileMenuOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
  useEffect(() => {
    if (!isMobileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const links = sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    links?.[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
        menuButton.current?.focus()
      }
      if (event.key === 'Tab' && links?.length) {
        const first = links[0],
          last = links[links.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMobileMenuOpen])

  return (
    <>
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      <header
        className="workspace-topbar no-print"
        data-workspace={isMemberView ? 'member' : 'admin'}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation"
            aria-expanded={isMobileMenuOpen}
            aria-controls="workspace-navigation"
            data-testid="mobile-menu-toggle"
            className="rounded-lg border bg-surface p-2 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {isMemberView ? 'My account' : 'Administration'}
          </span>
          <ChevronRight className="hidden h-3 w-3 text-muted-foreground sm:inline" />
          <span className="truncate text-sm font-medium">{pageName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {canFindMember && (
            <Link
              href="/dashboard/directory"
              className="hidden items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-xs text-muted-foreground md:flex"
            >
              <Search className="h-3.5 w-3.5" /> Find a member
            </Link>
          )}
          <ThemeToggle data-testid="sidebar-theme-toggle" />
          <span className="hidden h-6 border-l sm:inline" />
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
              {getInitials(user.name)}
            </span>
            <div className="hidden sm:block">
              <p className="max-w-[140px] truncate text-xs font-semibold">
                {user.name || 'Administrator'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isMemberView ? `Staff ID ${user.staffId || 'not set'}` : 'Admin workspace'}
              </p>
            </div>
          </div>
        </div>
      </header>
      {isMobileMenuOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        data-workspace={isMemberView ? 'member' : 'admin'}
        className={cn(
          'workspace-sidebar transition-transform duration-200',
          isMobileMenuOpen
            ? 'translate-x-0'
            : 'invisible -translate-x-full lg:visible lg:translate-x-0'
        )}
      >
        <div className="flex h-[88px] shrink-0 items-center justify-between px-6">
          <Link href={memberHref('/dashboard')} aria-label="Ummah Coop overview">
            <UmmahLogo compactText markClassName="h-9 w-9" />
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false)
              menuButton.current?.focus()
            }}
            aria-label="Close navigation"
            className="rounded-lg p-2 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {hasGrantedAccess ? (
          <div
            className="mx-4 mb-4 grid grid-cols-2 rounded-xl bg-surface-2 p-1"
            aria-label="Switch workspace"
          >
            <Link
              href="/dashboard?view=member"
              data-testid="switch-to-member-view"
              aria-current={isMemberView ? 'page' : undefined}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium',
                isMemberView ? 'bg-surface text-accent shadow-sm' : 'text-muted-foreground'
              )}
            >
              <CircleUserRound className="h-3.5 w-3.5" /> Member
            </Link>
            <Link
              href="/dashboard"
              data-testid="switch-to-admin-view"
              aria-current={!isMemberView ? 'page' : undefined}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium',
                !isMemberView ? 'bg-surface text-accent shadow-sm' : 'text-muted-foreground'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </Link>
          </div>
        ) : (
          <div className="mx-6 mb-6 flex items-center gap-2 text-xs font-semibold normal-case tracking-normal text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {isMemberView ? 'Member space' : 'Administration'}
          </div>
        )}
        <nav
          aria-label={isMemberView ? 'Member navigation' : 'Admin navigation'}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6"
        >
          {Object.entries(groups)
            .sort(([a], [b]) =>
              isMemberView
                ? 0
                : ['Workspace', 'Members & data', 'Requests', 'Finance', 'Settings'].indexOf(a) -
                  ['Workspace', 'Members & data', 'Requests', 'Finance', 'Settings'].indexOf(b)
            )
            .map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 px-3 text-xs font-medium normal-case tracking-normal text-muted-foreground">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map(({ href, label, icon: Icon, badge }) => {
                    const active =
                      pathname === href.split('?')[0] ||
                      (href.includes('/directory') && pathname.startsWith('/dashboard/directory/'))
                    return (
                      <Link
                        key={href}
                        href={memberHref(href)}
                        aria-current={active ? 'page' : undefined}
                        className={cn('nav-item', active && 'active')}
                        data-testid={`nav-${href.split('/').pop()?.split('?')[0]}`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1">{label}</span>
                        {badge && badgeCounts[badge] > 0 && (
                          <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">
                            {badgeCounts[badge]}
                          </span>
                        )}
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
        </nav>
        <div className="shrink-0 border-t p-4">
          {isMemberView && (
            <Link
              href="/dashboard/delete-account"
              className="nav-item !text-xs"
              data-testid="nav-delete-account"
            >
              <ShieldAlert className="h-4 w-4" /> Membership closure
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            data-testid="nav-sign-out"
            className="nav-item w-full"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
