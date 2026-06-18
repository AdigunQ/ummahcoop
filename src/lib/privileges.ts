export const PRIVILEGE_CODES = {
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  VIEW_MEMBER_DATA: 'VIEW_MEMBER_DATA',
  EDIT_MEMBERS: 'EDIT_MEMBERS',
  APPROVE_MEMBERS: 'APPROVE_MEMBERS',
  IMPORT_MEMBERS: 'IMPORT_MEMBERS',
  REVIEW_LOANS: 'REVIEW_LOANS',
  REVIEW_COMMODITY: 'REVIEW_COMMODITY',
  REVIEW_WITHDRAWALS: 'REVIEW_WITHDRAWALS',
  REVIEW_PAYMENTS: 'REVIEW_PAYMENTS',
  VIEW_FINANCE: 'VIEW_FINANCE',
  MANAGE_ACCESS: 'MANAGE_ACCESS',
} as const

export type PrivilegeCode = typeof PRIVILEGE_CODES[keyof typeof PRIVILEGE_CODES]

export const PRIVILEGE_LABELS: Record<PrivilegeCode, string> = {
  VIEW_ANALYTICS: 'View analytics',
  VIEW_MEMBER_DATA: 'View member data',
  EDIT_MEMBERS: 'Edit members',
  APPROVE_MEMBERS: 'Approve members',
  IMPORT_MEMBERS: 'Import workbook',
  REVIEW_LOANS: 'Review loans',
  REVIEW_COMMODITY: 'Review commodity',
  REVIEW_WITHDRAWALS: 'Review withdrawals',
  REVIEW_PAYMENTS: 'Review payments',
  VIEW_FINANCE: 'View finance reports',
  MANAGE_ACCESS: 'Manage admin access',
}

export const EXCO_VIEWER_PRIVILEGES: PrivilegeCode[] = [
  PRIVILEGE_CODES.VIEW_ANALYTICS,
  PRIVILEGE_CODES.VIEW_MEMBER_DATA,
  PRIVILEGE_CODES.REVIEW_LOANS,
  PRIVILEGE_CODES.REVIEW_COMMODITY,
  PRIVILEGE_CODES.REVIEW_WITHDRAWALS,
  PRIVILEGE_CODES.REVIEW_PAYMENTS,
  PRIVILEGE_CODES.VIEW_FINANCE,
]

export const EXCO_MANAGER_PRIVILEGES: PrivilegeCode[] = [
  ...EXCO_VIEWER_PRIVILEGES,
  PRIVILEGE_CODES.EDIT_MEMBERS,
  PRIVILEGE_CODES.APPROVE_MEMBERS,
  PRIVILEGE_CODES.IMPORT_MEMBERS,
]

export const DEVELOPER_PRIVILEGES: PrivilegeCode[] = [
  ...EXCO_MANAGER_PRIVILEGES,
  PRIVILEGE_CODES.MANAGE_ACCESS,
]

export const ACCESS_BUNDLES = {
  MEMBER: {
    label: 'Normal Member',
    description: 'Member-only access to personal dashboard, loans, commodity, withdrawals, and history.',
    privileges: [] satisfies PrivilegeCode[],
  },
  EXCO_VIEWER: {
    label: 'Exco Viewer',
    description: 'Read-only Exco access for dashboard, member data, reports, and request queues.',
    privileges: EXCO_VIEWER_PRIVILEGES,
  },
  EXCO_MANAGER: {
    label: 'Exco Manager',
    description: 'Read and write Exco access for approvals, workbook import, member updates, and request review.',
    privileges: EXCO_MANAGER_PRIVILEGES,
  },
  DEVELOPER: {
    label: 'Developer',
    description: 'Full system access, including granting and removing Exco privileges.',
    privileges: DEVELOPER_PRIVILEGES,
  },
} as const

export type AccessBundleKey = keyof typeof ACCESS_BUNDLES

export const MANAGEABLE_PRIVILEGES: PrivilegeCode[] = [
  PRIVILEGE_CODES.VIEW_ANALYTICS,
  PRIVILEGE_CODES.VIEW_MEMBER_DATA,
  PRIVILEGE_CODES.EDIT_MEMBERS,
  PRIVILEGE_CODES.APPROVE_MEMBERS,
  PRIVILEGE_CODES.IMPORT_MEMBERS,
  PRIVILEGE_CODES.REVIEW_LOANS,
  PRIVILEGE_CODES.REVIEW_COMMODITY,
  PRIVILEGE_CODES.REVIEW_WITHDRAWALS,
  PRIVILEGE_CODES.REVIEW_PAYMENTS,
  PRIVILEGE_CODES.VIEW_FINANCE,
  PRIVILEGE_CODES.MANAGE_ACCESS,
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
  { code: PRIVILEGE_CODES.IMPORT_MEMBERS, href: '/dashboard/import-members', label: 'Import Members', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_PAYMENTS, href: '/dashboard/payments', label: 'Payments', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_WITHDRAWALS, href: '/dashboard/withdrawals', label: 'Withdrawals', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_COMMODITY, href: '/dashboard/commodity', label: 'Commodity', group: 'Special access' },
  { code: PRIVILEGE_CODES.REVIEW_LOANS, href: '/dashboard/loans', label: 'Loans', group: 'Special access' },
  { code: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/vouchers', label: 'Reports', group: 'Special access' },
  { code: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/finance-report', label: 'Monthly Report', group: 'Special access' },
  { code: PRIVILEGE_CODES.VIEW_FINANCE, href: '/dashboard/transactions', label: 'Transactions', group: 'Special access' },
  { code: PRIVILEGE_CODES.MANAGE_ACCESS, href: '/dashboard/admin-access', label: 'Admin Access', group: 'Special access' },
]
