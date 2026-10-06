export function savingsPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(now)
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`
}

export function shiftSavingsPeriod(period: string, months = 1): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7)
}

export function validateSavingsPeriod(period: string, now = new Date()): void {
  const current = savingsPeriod(now)
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) || period <= current || period > shiftSavingsPeriod(current, 12)) {
    throw new Error('Choose next month or a later month within the next 12 months. Previous deductions cannot be changed.')
  }
}

export function parseSavingsAmount(value: unknown): number {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) throw new Error('Enter a whole-naira amount for both savings plans. Use 0 for a plan you do not want.')
  const amount = Number(text)
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) throw new Error('Each savings amount must be between 0 and 100,000,000 naira.')
  return amount
}

export function savingsPlanName(thrift: number, special: number): string {
  return thrift > 0 && special > 0 ? 'BOTH' : thrift > 0 ? 'THRIFT' : 'SPECIAL'
}
