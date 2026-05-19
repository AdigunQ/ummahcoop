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
import { cn, getInitials } from '@/lib/utils'

interface NavProps {
  user: {
    id: string
    name: string | null
    email: string
    role: string
    status: string
    balance: number
    loanBalance: number
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
}

const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/member-data', label: 'Member Data', icon: FileText },
  { href: '/dashboard/vouchers', label: 'Generate Report', icon: ScrollText },
  { href: '/dashboard/directory', label: 'Update Member', icon: Users },
  { href: '/dashboard/members', label: 'Member Approvals', icon: UserCheck, badge: 'pending' },
  { href: '/dashboard/payments', label: 'Payment Verifications', icon: ReceiptText, badge: 'payments' },
  { href: '/dashboard/withdrawals', label: 'Withdrawal Requests', icon: ArrowDownUp },
  { href: '/dashboard/commodity', label: 'Commodity Requests', icon: ShoppingBag },
  { href: '/dashboard/finance-report', label: 'Finance Monthly Report', icon: ClipboardList },
  { href: '/dashboard/analytics', label: 'Analytics', icon: LineChart },
  { href: '/dashboard/loans', label: 'Loan Requests', icon: HandCoins, badge: 'loans' },
  { href: '/dashboard/transactions', label: 'Transactions', icon: List },
]

const memberNavItems: NavItem[] = [
  { href: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/profile', label: 'Profile', icon: Settings },
  { href: '/dashboard/withdrawals', label: 'Withdraw', icon: ArrowDownUp },
  { href: '/dashboard/commodity', label: 'Commodity Request', icon: ShoppingBag },
  { href: '/dashboard/apply-loan', label: 'Apply for Loan', icon: HandCoins },
  { href: '/dashboard/my-loans', label: 'My Loans', icon: FileText },
  { href: '/dashboard/history', label: 'Transaction History', icon: PiggyBank },
]

export function DashboardNav({ user, adminBadges }: NavProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = user.role === 'ADMIN' ? adminNavItems : memberNavItems
  const badgeCounts = {
    pending: adminBadges?.pendingMembers ?? 0,
    payments: adminBadges?.pendingPayments ?? 0,
    loans: adminBadges?.pendingLoans ?? 0,
  } as const

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-lg"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 w-64 h-screen bg-gray-900 text-white transition-transform duration-300 ease-in-out',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Top section */}
          {user.role === 'MEMBER' ? (
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 rounded-lg">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center font-semibold">
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-primary-500/20 text-primary-300 text-xs rounded-full">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 border-b border-gray-800">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-sm leading-tight">FAAN STAFF UMMAH</h1>
                  <p className="text-xs text-gray-400">MULTIPURPOSE COOPERATIVE</p>
                </div>
              </Link>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  pathname === item.href
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {user.role === 'ADMIN' &&
                  item.badge &&
                  badgeCounts[item.badge] > 0 && (
                    <span className="ml-auto inline-flex min-w-[1.6rem] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                      {badgeCounts[item.badge]}
                    </span>
                  )}
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-800">
            {user.role !== 'MEMBER' && (
              <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-gray-800 rounded-lg">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center font-semibold">
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-primary-500/20 text-primary-300 text-xs rounded-full">
                    {user.role}
                  </span>
                </div>
              </div>
            )}

            {user.role === 'MEMBER' && (
              <div className="mb-4 px-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Balance:</span>
                  <span className="text-green-400">₦{user.balance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Loan:</span>
                  <span className="text-orange-400">₦{user.loanBalance.toLocaleString()}</span>
                </div>
                <Link
                  href="/dashboard/delete-account"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname === '/dashboard/delete-account'
                      ? 'bg-red-500/20 text-red-300'
                      : 'text-red-400 hover:bg-red-500/10'
                  )}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Delete Account</span>
                </Link>
              </div>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
