import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import { registerPayloadSchema } from '../src/lib/registration'
import { verifyStoredPassword } from '../src/lib/password-verification'
import { getLoanLimit, hasLoanTenureElapsed } from '../src/lib/loan-request'

const registration = { name: 'Release Test', staffId: '000123', password: 'Release-test-password', confirmPassword: 'Release-test-password' }

for (const savingsPlan of ['THRIFT', 'SPECIAL', 'BOTH']) {
  test(`registration preserves Staff ID and selected ${savingsPlan} contributions`, () => {
    const parsed = registerPayloadSchema.parse({ ...registration, savingsPlan, thriftAmount: savingsPlan === 'SPECIAL' ? 0 : '25,000', specialAmount: savingsPlan === 'THRIFT' ? 0 : 10000 })
    assert.equal(parsed.staffId, '000123')
    assert.equal(parsed.thriftAmount, savingsPlan === 'SPECIAL' ? undefined : 25000)
    assert.equal(parsed.specialAmount, savingsPlan === 'THRIFT' ? undefined : 10000)
    assert.equal(parsed.phone, undefined)
  })
}

test('registration rejects invalid IDs, missing selected amounts, and mismatched passwords', () => {
  const valid = { ...registration, savingsPlan: 'BOTH', thriftAmount: 1000, specialAmount: 500 }
  for (const change of [{ staffId: '000/123' }, { thriftAmount: 0 }, { specialAmount: -1 }, { confirmPassword: 'different' }, { savingsPlan: '' }]) {
    assert.equal(registerPayloadSchema.safeParse({ ...valid, ...change }).success, false)
  }
})

test('chosen passwords authenticate without allowing a Staff ID override', async () => {
  const account = { staffId: '000123', role: 'MEMBER', password: await bcrypt.hash('Chosen-password', 4) }
  assert.equal(await verifyStoredPassword(account, 'Chosen-password'), true)
  assert.equal(await verifyStoredPassword(account, '000123'), false)
  assert.equal(await verifyStoredPassword(account, 'wrong-password'), false)
  assert.equal(await bcrypt.compare('Chosen-password', account.password), true)
})

test('existing Staff ID password hashes remain usable without losing leading zeros', async () => {
  const account = { staffId: '000123', role: 'MEMBER', password: await bcrypt.hash('000123', 4) }
  assert.equal(await verifyStoredPassword(account, '000123'), true)
  assert.equal(await verifyStoredPassword(account, '123'), false)
  assert.equal(await verifyStoredPassword({ ...account, password: null }, '000123'), false)
})

test('loan eligibility retains six complete months and a thrift-only limit', () => {
  const now = new Date('2026-09-06T12:00:00Z')
  assert.equal(hasLoanTenureElapsed(new Date('2026-03-06T12:00:00Z'), now), true)
  assert.equal(hasLoanTenureElapsed(new Date('2026-03-07T12:00:00Z'), now), false)
  assert.equal(hasLoanTenureElapsed(new Date('2026-02-01T12:00:00Z'), now), true)
  assert.equal(getLoanLimit(0), 0)
  assert.equal(getLoanLimit(25000), 50000)
})
