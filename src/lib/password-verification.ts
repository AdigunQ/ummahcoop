import bcrypt from 'bcryptjs'

type AccountPassword = { password: string | null; staffId: string | null; role: string }

function compact(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
}

export async function verifyStoredPassword(account: AccountPassword, submitted: string) {
  if (!account.password) return false
  if (await bcrypt.compare(submitted, account.password)) return true
  // Legacy imports sometimes hashed a normalized Staff ID password.
  // Compatibility still requires a matching stored hash, never a password reset.
  if (account.role !== 'MEMBER' || !account.staffId || compact(submitted) !== compact(account.staffId)) return false
  return bcrypt.compare(compact(account.staffId), account.password)
}
