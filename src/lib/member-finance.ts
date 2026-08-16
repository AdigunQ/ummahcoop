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

async function readMemberPrincipals(userId: string) {
  // Read through JSON so an older production database can still render the
  // dashboard while the additive principal-column migration is being applied.
  const rows = await prisma.$queryRaw<Array<{ loanPrincipal: number | null; commodityPrincipal: number | null }>>`
    SELECT
      COALESCE((to_jsonb(u)->>'loan_principal')::double precision, 0) AS "loanPrincipal",
      COALESCE((to_jsonb(u)->>'commodity_principal')::double precision, 0) AS "commodityPrincipal"
    FROM "users" AS u
    WHERE u.id = ${userId}
    LIMIT 1
  `

  return rows[0] || { loanPrincipal: 0, commodityPrincipal: 0 }
}

/**
 * Combines imported monthly deductions with live workflow records. The
 * imported Loan and Commodity columns are deductions, not original amounts;
 * the original amounts are stored on User and entered by an admin.
 */
export async function getMemberFinanceSummary(
  userId: string,
  staffId: string | null | undefined
): Promise<MemberFinanceSummary> {
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
      prisma.commodityRepayment.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.memberDataMonth.findMany({
        orderBy: { period: 'asc' },
        select: { period: true, rows: true },
      }),
    ])

  const normalizedStaffId = normalizeStaffId(staffId)
  let ledgerLoanPaid = 0
  let ledgerCommodityPaid = 0
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
      ledgerLoanPaid += loanDeduction
      loanRepaymentStartPeriod = loanRepaymentStartPeriod || snapshot.period
    }
    if (commodityDeduction > 0) {
      ledgerCommodityPaid += commodityDeduction
      commodityRepaymentStartPeriod = commodityRepaymentStartPeriod || snapshot.period
    }
  }

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
  const loanPaid = ledgerLoanPaid > 0 ? ledgerLoanPaid : workflowLoanPaid
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
  const commodityPaid = ledgerCommodityPaid > 0 ? ledgerCommodityPaid : workflowCommodityPaid

  return {
    loanCount: Math.max(approvedLoans.length, loanPrincipal > 0 || ledgerLoanPaid > 0 ? 1 : 0),
    loanPrincipal,
    loanCollected,
    loanPaid,
    loanOutstanding,
    loanRepaymentStartPeriod,
    commodityCount: Math.max(approvedCommodities.length, commodityPrincipal > 0 || ledgerCommodityPaid > 0 ? 1 : 0),
    commodityPrincipal,
    commodityCollected,
    commodityPaid,
    commodityOutstanding: Math.max(commodityCollected - commodityPaid, 0),
    commodityRepaymentStartPeriod,
    ledgerPeriod: snapshots[snapshots.length - 1]?.period || null,
  }
}
