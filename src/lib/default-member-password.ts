export function getDefaultMemberPassword(): string {
  const configured = process.env.DEFAULT_MEMBER_PASSWORD?.trim()
  if (configured) return configured

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DEFAULT_MEMBER_PASSWORD is not configured.')
  }

  return 'member123'
}
