export function registrationDateInputValue(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function parseMemberRegistrationDate(value: unknown, now = new Date()): Date | null {
  if (typeof value !== 'string') return null
  const input = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || input > registrationDateInputValue(now)) return null

  // Store the calendar date consistently, independent of the server's timezone.
  const date = new Date(`${input}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) return null
  return date
}
