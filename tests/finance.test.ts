import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { PrismaClient } from '@prisma/client'

const prisma = {
  $queryRaw: async (): Promise<Array<{ loanPrincipal: number; commodityPrincipal: number }>> => [
    { loanPrincipal: 0, commodityPrincipal: 0 },
  ],
  loan: { findMany: async () => [] },
  payment: { aggregate: async () => ({ _sum: { amount: null } }) },
  commodityRequest: { findMany: async () => [] },
  commodityRepayment: { aggregate: async () => ({ _sum: { amount: null } }) },
  memberDataMonth: { findMany: async () => [] },
}
// Use the application's existing client singleton seam in this isolated test worker.
;(globalThis as unknown as { prisma: PrismaClient }).prisma = prisma as unknown as PrismaClient
const finance = import('../src/lib/member-finance')

// All reads are mocked: these tests must never connect to a member database.
function mockReads(t: TestContext) {
  const reads = [
    t.mock.method(prisma, '$queryRaw', async () => [{ loanPrincipal: 0, commodityPrincipal: 0 }]),
    t.mock.method(prisma.loan, 'findMany', async () => []),
    t.mock.method(prisma.payment, 'aggregate', async () => ({ _sum: { amount: null } })),
    t.mock.method(prisma.commodityRequest, 'findMany', async () => []),
    t.mock.method(prisma.commodityRepayment, 'aggregate', async () => ({ _sum: { amount: null } })),
    t.mock.method(prisma.memberDataMonth, 'findMany', async () => []),
  ]
  t.mock.method(console, 'error', () => {})
  return reads
}

test('an empty but successfully loaded account may report zero balances', async (t) => {
  mockReads(t)
  const { getMemberFinanceSummary } = await finance
  const summary = await getMemberFinanceSummary('fictional-member', '009709')
  assert.equal(summary.loanOutstanding, 0)
  assert.equal(summary.commodityOutstanding, 0)
  assert.equal(summary.ledgerPeriod, null)
})
;['principal', 'loans', 'payments', 'commodities', 'commodity repayments', 'ledger'].forEach(
  (source, index) => {
    test(`failed ${source} reads never turn into a successful zero balance`, async (t) => {
      const reads = mockReads(t)
      const { getMemberFinanceSummary } = await finance
      reads[index].mock.mockImplementation(async () => {
        throw new Error('Private connection details')
      })
      await assert.rejects(getMemberFinanceSummary('fictional-member', '009709'), {
        message: 'Member financial records are temporarily unavailable.',
      })
    })
  }
)

test('missing member principal records are not treated as an empty account', async (t) => {
  mockReads(t)
  t.mock.method(prisma, '$queryRaw', async () => [])
  const { getMemberFinanceSummary } = await finance
  await assert.rejects(getMemberFinanceSummary('missing-member', '009709'))
})

test('monthly deductions retain their original amounts and exact Staff IDs', async () => {
  const { sumLedgerDeductions } = await finance
  const result = sumLedgerDeductions(
    [
      {
        period: '2026-06',
        rows: [
          { 'Staff ID': '009709', Loan: 10000, Commodity: 5000, 'Monthly Fee': 100 },
          { 'Staff ID': '9709', Loan: 999999, Commodity: 999999 },
        ],
      },
      {
        period: '2026-07',
        rows: [
          { 'Employee No.': '009709', Loan: '20,000', Commodity: '15,000', 'Monthly Fee': 100 },
        ],
      },
    ],
    '009709'
  )
  assert.deepEqual(result, {
    loanPaid: 30000,
    commodityPaid: 20000,
    loanRepaymentStartPeriod: '2026-06',
    commodityRepaymentStartPeriod: '2026-06',
  })
})
