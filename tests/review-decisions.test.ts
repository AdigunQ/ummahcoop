import assert from 'node:assert/strict'
import test from 'node:test'
import type { Loan, Payment, PrismaClient } from '@prisma/client'

const loan = { id: 'local-loan', userId: 'local-member', amount: 10000, interestRate: 5, duration: 6, purpose: 'Test' } as Loan
const payment = { id: 'local-payment', userId: 'local-member', amount: 1000, type: 'CONTRIBUTION', notes: null } as Payment
type State = { loanStatus: string; paymentStatus: string; balance: number; loanBalance: number; entries: number }
let state: State
let failLedger = false

function reset() {
  state = { loanStatus: 'PENDING', paymentStatus: 'PENDING', balance: 50000, loanBalance: 0, entries: 0 }
  failLedger = false
}

// A transactional in-memory fake: these tests never connect to any database.
const tx = {
  loan: { updateMany: async ({ where, data }: any) => {
    assert.equal(where.status, 'PENDING')
    if (state.loanStatus !== where.status) return { count: 0 }
    state.loanStatus = data.status
    return { count: 1 }
  } },
  payment: { updateMany: async ({ where, data }: any) => {
    assert.equal(where.status, 'PENDING')
    if (state.paymentStatus !== where.status) return { count: 0 }
    state.paymentStatus = data.status
    return { count: 1 }
  } },
  user: {
    updateMany: async ({ where, data }: any) => {
      assert.equal(where.status, 'ACTIVE')
      assert.equal(where.balance.gte, 5000)
      if (state.loanBalance > where.loanBalance.lte || state.balance < where.balance.gte) return { count: 0 }
      state.loanBalance += data.loanBalance.increment
      return { count: 1 }
    },
    update: async ({ data }: any) => {
      state.balance += data.balance.increment
      state.loanBalance += data.loanBalance.increment
    },
  },
  transaction: {
    create: async () => { if (failLedger) throw new Error('Ledger unavailable'); state.entries += 1 },
    upsert: async () => { if (failLedger) throw new Error('Ledger unavailable'); state.entries += 1 },
  },
}
const client = { $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => {
  const before = { ...state }
  try { return await operation(tx) } catch (error) { state = before; throw error }
} }
;(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient
const decisions = import('../src/lib/review-decisions')

test('loan approval records principal and fee once, and cannot be reversed by a repeated decision', async () => {
  reset()
  const { saveLoanDecision } = await decisions
  assert.equal(await saveLoanDecision(loan, true, 'admin'), true)
  assert.equal(state.loanBalance, 10500)
  assert.equal(await saveLoanDecision(loan, true, 'admin'), false)
  assert.equal(await saveLoanDecision(loan, false, 'admin'), false)
  assert.equal(state.loanStatus, 'APPROVED')
  assert.equal(state.loanBalance, 10500)
  assert.equal(state.entries, 1)
})

test('failed loan ledger write rolls back approval and outstanding balance', async () => {
  reset()
  failLedger = true
  const before = { ...state }
  await assert.rejects((await decisions).saveLoanDecision(loan, true, 'admin'))
  assert.deepEqual(state, before)
})

test('changed member eligibility leaves the request pending and balances untouched', async () => {
  reset()
  state.loanBalance = 2000
  const before = { ...state }
  await assert.rejects((await decisions).saveLoanDecision(loan, true, 'admin'), /eligibility changed/)
  assert.deepEqual(state, before)
})

test('loan rejection does not create a disbursement or alter member balances', async () => {
  reset()
  await (await decisions).saveLoanDecision(loan, false, 'admin')
  assert.equal(state.loanStatus, 'REJECTED')
  assert.equal(state.loanBalance, 0)
  assert.equal(state.entries, 0)
})

test('payment approval credits a member only once', async () => {
  reset()
  const { savePaymentDecision } = await decisions
  assert.equal(await savePaymentDecision(payment, true, 'admin'), true)
  assert.equal(await savePaymentDecision(payment, true, 'admin'), false)
  assert.equal(await savePaymentDecision(payment, false, 'admin'), false)
  assert.equal(state.paymentStatus, 'APPROVED')
  assert.equal(state.balance, 51000)
  assert.equal(state.entries, 1)
})

test('failed payment ledger write rolls back payment status and member credit', async () => {
  reset()
  failLedger = true
  const before = { ...state }
  await assert.rejects((await decisions).savePaymentDecision(payment, true, 'admin'))
  assert.deepEqual(state, before)
})
