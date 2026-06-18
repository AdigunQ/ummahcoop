export function getInitialMemberPassword(staffId: string): string {
  const configured = process.env.DEFAULT_MEMBER_PASSWORD?.trim()
  if (configured) return configured

  const normalizedStaffId = staffId.trim().replace(/\s+/g, '').toUpperCase()
  if (normalizedStaffId) return normalizedStaffId

  throw new Error('Staff ID is required to create an initial member password.')
}

export const getDefaultMemberPassword = getInitialMemberPassword
