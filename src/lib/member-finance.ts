import { prisma } from '@/lib/prisma'

type SnapshotRow = Record<string, unknown>

export type MemberFinanceSummary = {
  loanCount: number
  loanCollected: number
  loanPaid: number
  loanOutstanding: number
  commodityCount: number
  commodityCollected: number
  commodityPaid: number
  commodityOutstanding: number
  ledgerPeriod: string | null
}

function normalizeStaffId(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function pickNumber(row: SnapshotRow | undefined, keys: string[]): number {
  if (!row) return 0
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return toNumber(row[key])
  }
  return 0
}

function rowsFromJson(value: unknown): SnapshotRow[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is SnapshotRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row)
  )
}

/**
 * Combines the imported ledger with live workflow records. The ledger is the
 * fallback for historical loans/commodities that were imported without a
 * corresponding request record; live repayment records always remain separate.
 */
export async function getMemberFinanceSummary(
  userId: string,
  staffId: string | null | undefined
): Promise<MemberFinanceSummary> {
  const [approvedLoans, loanRepaymentPayments, approvedCommodities, commodityRepayments, latestSnapshot] =
    await Promise.all([
      prisma.loan.findMany({
        where: { userId, status: { in: ['APPROVED', 'COMPLETED'] } },
        select: {
          amount: true,
          balance: true,
          repayments: { select: { amount: true } },
        },
      }),
      prisma.payment.aggregate({
        where: { userId, type: 'LOAN_REPAYMENT', status: 'APPROVED' },
        _sum: { amount: true },
      }),
      prisma.commodityRequest.findMany({
        where: { userId, status: 'APPROVED' },
        select: { adminQuotedPrice: true, preferredBudget: true },
      }),
      prisma.commodityRepayment.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.memberDataMonth.findFirst({
        orderBy: { period: 'desc' },
        select: { period: true, rows: true },
      }),
    ])

  const normalizedStaffId = normalizeStaffId(staffId)
  const ledgerRow = rowsFromJson(latestSnapshot?.rows).find((row) => {
    const rowStaffId = row['Staff ID'] ?? row['Employee No.']
    return normalizeStaffId(rowStaffId) === normalizedStaffId
  })

  const ledgerLoan = pickNumber(ledgerRow, ['Loan', 'Loan Originated'])
  const ledgerCommodity = pickNumber(ledgerRow, ['Commodity', 'Commodity Requests', 'Comodity'])
  const workflowLoanCollected = approvedLoans.reduce((sum, loan) => sum + loan.amount, 0)
  const workflowLoanOutstanding = approvedLoans.reduce((sum, loan) => sum + Math.max(0, loan.balance), 0)
  const loanPaidFromRepayments = approvedLoans.reduce(
    (sum, loan) => sum + loan.repayments.reduce((loanSum, repayment) => loanSum + repayment.amount, 0),
    0
  )
  const loanPaidFromPayments = loanRepaymentPayments._sum.amount || 0
  const loanPaid = loanPaidFromRepayments + loanPaidFromPayments
  const loanCollected = Math.max(ledgerLoan, workflowLoanCollected)
  const loanOutstanding = Math.max(
    workflowLoanOutstanding || loanCollected - loanPaid,
    0
  )

  const workflowCommodityCollected = approvedCommodities.reduce(
    (sum, request) => sum + (request.adminQuotedPrice || request.preferredBudget || 0),
    0
  )
  const commodityCollected = Math.max(ledgerCommodity, workflowCommodityCollected)
  const commodityPaid = commodityRepayments._sum.amount || 0

  return {
    loanCount: Math.max(approvedLoans.length, ledgerLoan > 0 ? 1 : 0),
    loanCollected,
    loanPaid,
    loanOutstanding,
    commodityCount: Math.max(approvedCommodities.length, ledgerCommodity > 0 ? 1 : 0),
    commodityCollected,
    commodityPaid,
    commodityOutstanding: Math.max(commodityCollected - commodityPaid, 0),
    ledgerPeriod: latestSnapshot?.period || null,
  }
}
