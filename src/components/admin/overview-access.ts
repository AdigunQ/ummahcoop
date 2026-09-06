import { PRIVILEGE_CODES, PRIVILEGE_ROUTE_MAP } from '@/lib/privileges'

export function canOpenAdminRoute(href: string, codes?: readonly string[]) {
  if (!codes) return true
  const route = href.split('?')[0]
  return PRIVILEGE_ROUTE_MAP.some((entry) => entry.href === route && codes.includes(entry.code))
}

export function canViewAdminOverview(codes: readonly string[]) {
  return codes.includes(PRIVILEGE_CODES.VIEW_ANALYTICS)
}
