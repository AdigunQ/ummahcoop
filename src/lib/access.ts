import { prisma } from './prisma'
import { PRIVILEGE_CODES, type PrivilegeCode } from './privileges'

export { MANAGEABLE_PRIVILEGES, PRIVILEGE_CODES, PRIVILEGE_LABELS, PRIVILEGE_ROUTE_MAP } from './privileges'
export type { PrivilegeCode } from './privileges'

export async function getUserPrivilegeCodes(userId: string): Promise<PrivilegeCode[]> {
  const grants = await prisma.memberPrivilege.findMany({
    where: { userId },
    select: { code: true },
    orderBy: { createdAt: 'asc' },
  })

  return grants
    .map((grant) => grant.code as PrivilegeCode)
    .filter((code, index, list) => list.indexOf(code) === index)
}

export function hasPrivilege(codes: Iterable<string>, required: PrivilegeCode | PrivilegeCode[]) {
  const requiredList = Array.isArray(required) ? required : [required]
  const codeSet = new Set(codes)
  return requiredList.some((code) => codeSet.has(code))
}

export async function canAccessWithPrivileges(
  user: { role: string; id: string },
  required: PrivilegeCode | PrivilegeCode[]
): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return true
  }

  const codes = await getUserPrivilegeCodes(user.id)
  return hasPrivilege(codes, required)
}
