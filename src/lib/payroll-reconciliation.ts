type ReconciledLoan = {
  applicationData: unknown
  repayments: Array<{ amount: number; date: Date }>
}

export function getPayrollSettlementPeriod(applicationData: unknown): string | null {
  if (!applicationData || typeof applicationData !== 'object' || Array.isArray(applicationData)) return null
  const value = (applicationData as Record<string, unknown>).payrollReconciliation
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (record.version !== 1 || typeof record.settledPeriod !== 'string') return null
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(record.settledPeriod) ? record.settledPeriod : null
}

// Verified repayments replace the same month's imported deduction. This also
// includes confirmed months for which a complete workbook has not been uploaded.
export function getReconciledPayrollRepayments(loans: ReconciledLoan[]): Map<string, number> {
  const result = new Map<string, number>()
  for (const loan of loans) {
    const settledPeriod = getPayrollSettlementPeriod(loan.applicationData)
    if (!settledPeriod) continue
    for (const repayment of loan.repayments) {
      if (!Number.isFinite(repayment.amount) || repayment.amount <= 0) continue
      const period = repayment.date.toISOString().slice(0, 7)
      if (period > settledPeriod) continue
      result.set(period, (result.get(period) || 0) + repayment.amount)
    }
  }
  return result
}
