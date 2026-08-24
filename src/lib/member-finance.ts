import { prisma } from '@/lib/prisma'

type SnapshotRow = Record<string, unknown>

export type MemberFinanceSummary = {
  loanCount: number
  loanPrincipal: number
  loanCollected: number
  loanPaid: number
  loanOutstanding: number
  loanRepaymentStartPeriod: string | null
  commodityCount: number
  commodityPrincipal: number
  commodityCollected: number
  commodityPaid: number
  commodityOutstanding: number
  commodityRepaymentStartPeriod: string | null
  ledgerPeriod: string | null
}

function normalizeStaffId(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const normalized = raw
    .replace(/[₦$]/g, '')
    .replace(/,/g, '')
    .replace(/^\((.*)\)$/, '-$1')
    .trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function pickNumber(row: SnapshotRow | undefined, keys: string[]): number {
  if (!row) return 0
  for (const key of keys) {
    const value = row[key]
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) continue
    return toNumber(value)
  }
  return 0
}

function rowsFromJson(value: unknown): SnapshotRow[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is SnapshotRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row)
  )
}

type LedgerDeductionTotals = {
  loanPaid: number
  commodityPaid: number
  loanRepaymentStartPeriod: string | null
  commodityRepaymentStartPeriod: string | null
}

/**
 * Imported Loan and Commodity cells are payroll deductions. They must be
 * counted exactly as entered; the separate 100 naira monthly charge must
 * never be subtracted from either column.
 */
export function sumLedgerDeductions(
  snapshots: Array<{ period: string; rows: unknown }>,
  staffId: string | null | undefined
): LedgerDeductionTotals {
  const normalizedStaffId = normalizeStaffId(staffId)
  let loanPaid = 0
  let commodityPaid = 0
  let loanRepaymentStartPeriod: string | null = null
  let commodityRepaymentStartPeriod: string | null = null

  for (const snapshot of snapshots) {
    const ledgerRow = rowsFromJson(snapshot.rows).find((row) => {
      const rowStaffId = row['Staff ID'] ?? row['Employee No.']
      return normalizeStaffId(rowStaffId) === normalizedStaffId
    })

    const loanDeduction = pickNumber(ledgerRow, ['Loan', 'Loan Originated'])
    const commodityDeduction = pickNumber(ledgerRow, ['Commodity', 'Commodity Requests', 'Comodity'])

    if (loanDeduction > 0) {
      loanPaid += loanDeduction
      loanRepaymentStartPeriod = loanRepaymentStartPeriod || snapshot.period
    }
    if (commodityDeduction > 0) {
      commodityPaid += commodityDeduction
      commodityRepaymentStartPeriod = commodityRepaymentStartPeriod || snapshot.period
    }
  }

  return {
    loanPaid,
    commodityPaid,
    loanRepaymentStartPeriod,
    commodityRepaymentStartPeriod,
  }
}

async function readMemberPrincipals(userId: string) {
  // Read through JSON so an older production database can still render the
  // dashboard while the additive principal-column migration is being applied.
  try {
    const rows = await prisma.$queryRaw<Array<{ loanPrincipal: number | null; commodityPrincipal: number | null }>>`
      SELECT
        COALESCE((to_jsonb(u)->>'loan_principal')::double precision, 0) AS "loanPrincipal",
        COALESCE((to_jsonb(u)->>'commodity_principal')::double precision, 0) AS "commodityPrincipal"
      FROM "users" AS u
      WHERE u.id = ${userId}
      LIMIT 1
    `

    return rows[0] || { loanPrincipal: 0, commodityPrincipal: 0 }
  } catch {
    return { loanPrincipal: 0, commodityPrincipal: 0 }
  }
}

/**
 * Combines imported monthly deductions with live workflow records. The
 * imported Loan and Commodity columns are deductions, not original amounts;
 * the original amounts are stored on User and entered by an admin.
 */
async function loadMemberFinanceSummary(
  userId: string,
  staffId: string | null | undefined
): Promise<MemberFinanceSummary> {
  const commodityRepaymentAggregate = prisma.commodityRepayment
    .aggregate({
      where: { userId },
      _sum: { amount: true },
    })
    .catch(() => ({ _sum: { amount: 0 } }))

  const [member, approvedLoans, loanRepaymentPayments, approvedCommodities, commodityRepayments, snapshots] =
    await Promise.all([
      readMemberPrincipals(userId),
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
      commodityRepaymentAggregate,
      prisma.memberDataMonth.findMany({
        orderBy: { period: 'asc' },
        select: { period: true, rows: true },
      }),
    ])

  const ledgerTotals = sumLedgerDeductions(snapshots, staffId)

  const workflowLoanCollected = approvedLoans.reduce((sum, loan) => sum + loan.amount, 0)
  const workflowLoanOutstanding = approvedLoans.reduce((sum, loan) => sum + Math.max(0, loan.balance), 0)
  const loanPaidFromRepayments = approvedLoans.reduce(
    (sum, loan) => sum + loan.repayments.reduce((loanSum, repayment) => loanSum + repayment.amount, 0),
    0
  )
  const loanPaidFromPayments = loanRepaymentPayments._sum.amount || 0
  const workflowLoanPaid = loanPaidFromRepayments + loanPaidFromPayments
  const loanPrincipal = Math.max(toNumber(member?.loanPrincipal), workflowLoanCollected)
  const loanCollected = loanPrincipal
  const loanPaid = ledgerTotals.loanPaid > 0 ? ledgerTotals.loanPaid : workflowLoanPaid
  const loanOutstanding =
    loanPrincipal > 0
      ? Math.max(loanPrincipal - loanPaid, 0)
      : Math.max(workflowLoanOutstanding, 0)

  const workflowCommodityCollected = approvedCommodities.reduce(
    (sum, request) => sum + (request.adminQuotedPrice || request.preferredBudget || 0),
    0
  )
  const commodityPrincipal = Math.max(toNumber(member?.commodityPrincipal), workflowCommodityCollected)
  const commodityCollected = commodityPrincipal
  const workflowCommodityPaid = commodityRepayments._sum.amount || 0
  const commodityPaid = ledgerTotals.commodityPaid > 0 ? ledgerTotals.commodityPaid : workflowCommodityPaid

  return {
    loanCount: Math.max(approvedLoans.length, loanPrincipal > 0 || ledgerTotals.loanPaid > 0 ? 1 : 0),
    loanPrincipal,
    loanCollected,
    loanPaid,
    loanOutstanding,
    loanRepaymentStartPeriod: ledgerTotals.loanRepaymentStartPeriod,
    commodityCount: Math.max(approvedCommodities.length, commodityPrincipal > 0 || ledgerTotals.commodityPaid > 0 ? 1 : 0),
    commodityPrincipal,
    commodityCollected,
    commodityPaid,
    commodityOutstanding: Math.max(commodityCollected - commodityPaid, 0),
    commodityRepaymentStartPeriod: ledgerTotals.commodityRepaymentStartPeriod,
    ledgerPeriod: snapshots[snapshots.length - 1]?.period || null,
  }
}

export async function getMemberFinanceSummary(
  userId: string,
  staffId: string | null | undefined
): Promise<MemberFinanceSummary> {
  try {
    return await loadMemberFinanceSummary(userId, staffId)
  } catch (error) {
    console.error('[member-finance] summary unavailable', error)
    return {
      loanCount: 0,
      loanPrincipal: 0,
      loanCollected: 0,
      loanPaid: 0,
      loanOutstanding: 0,
      loanRepaymentStartPeriod: null,
      commodityCount: 0,
      commodityPrincipal: 0,
      commodityCollected: 0,
      commodityPaid: 0,
      commodityOutstanding: 0,
      commodityRepaymentStartPeriod: null,
      ledgerPeriod: null,
    }
  }
}
