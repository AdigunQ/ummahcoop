export const PRIVILEGE_CODES = {
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  VIEW_MEMBER_DATA: 'VIEW_MEMBER_DATA',
  EDIT_MEMBERS: 'EDIT_MEMBERS',
  APPROVE_MEMBERS: 'APPROVE_MEMBERS',
  REVIEW_LOANS: 'REVIEW_LOANS',
  REVIEW_COMMODITY: 'REVIEW_COMMODITY',
  REVIEW_WITHDRAWALS: 'REVIEW_WITHDRAWALS',
  REVIEW_PAYMENTS: 'REVIEW_PAYMENTS',
  VIEW_FINANCE: 'VIEW_FINANCE',
} as const

export type PrivilegeCode = typeof PRIVILEGE_CODES[keyof typeof PRIVILEGE_CODES]

export const PRIVILEGE_LABELS: Record<PrivilegeCode, string> = {
  VIEW_ANALYTICS: 'View analytics',
  VIEW_MEMBER_DATA: 'View member data',
  EDIT_MEMBERS: 'Edit members',
  APPROVE_MEMBERS: 'Approve members',
  REVIEW_LOANS: 'Review loans',
  REVIEW_COMMODITY: 'Review commodity',
  REVIEW_WITHDRAWALS: 'Review withdrawals',
  REVIEW_PAYMENTS: 'Review payments',
  VIEW_FINANCE: 'View finance reports',
}

export const MANAGEABLE_PRIVILEGES: PrivilegeCode[] = [
  PRIVILEGE_CODES.VIEW_ANALYTICS,
  PRIVILEGE_CODES.VIEW_MEMBER_DATA,
  PRIVILEGE_CODES.EDIT_MEMBERS,
  PRIVILEGE_CODES.APPROVE_MEMBERS,
  PRIVILEGE_CODES.REVIEW_LOANS,
  PRIVILEGE_CODES.REVIEW_COMMODITY,
  PRIVILEGE_CODES.REVIEW_WITHDRAWALS,
  PRIVILEGE_CODES.REVIEW_PAYMENTS,
  PRIVILEGE_CODES.VIEW_FINANCE,
]

export const PRIVILEGE_ROUTE_MAP: Array<{
  code: PrivilegeCode
  href: string
  label: string
  group: string
}> = [
  { code: PRIVILEGE_CODES.VIEW_ANALYTICS, href: '/dashboard/analytics', label: 'Analytics', group: 'Special access' },
  { code: PRIVILEGE_CODES.VIEW_MEMBER_DATA, href: '/dashboard/member-data', label: 'Member Data', group: 'Special access' },
  { code: PRIVILEGE_CODES.EDIT_MEMBERS, href: '/dashboard/directory', label: 'Update Member', group: 'Special access' },
  { code: PRIVILEGE_CODES.APPROVE_MEMBERS, href: '/dashboard/members', label: 'Approvals', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_PAYMENTS, href: '/dashboard/payments', label: 'Payments', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_WITHDRAWALS, href: '/dashboard/withdrawals', label: 'Withdrawals', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_COMMODITY, href: '/dashboard/commodity', label: 'Commodity', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_LOANS, href: '/dashboard/loans', label: 'Loans', group: 'Special access' },
  { code: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/vouchers', label: 'Reports', group: 'Special access' },
  { code: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/finance-report', label: 'Monthly Report', group: 'Special access' },
  { code: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/transactions', label: 'Transactions', group: 'Special access' },
]
