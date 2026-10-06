import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSavingsAmount, parseSavingsChangePlan, savingsPeriod, shiftSavingsPeriod, validateSavingsPeriod } from '../src/lib/savings-change-policy'
import { canOpenAdminRoute } from '../src/components/admin/overview-access'

test('savings changes use the Nigerian calendar, including month and year boundaries', () => {
  assert.equal(savingsPeriod(new Date('2026-10-31T23:30:00Z')), '2026-11')
  assert.equal(shiftSavingsPeriod('2026-12'), '2027-01')
  assert.equal(shiftSavingsPeriod('2026-10', 12), '2027-10')
})

test('changes require a future month, never the current or a historical payroll period', () => {
  const now = new Date('2026-10-06T12:00:00Z')
  for (const month of ['2026-11', '2026-12', '2027-10']) assert.doesNotThrow(() => validateSavingsPeriod(month, now))
  for (const month of ['', '2026-09', '2026-10', '2026-13', '2027-11', '2026-1', 'November 2026']) assert.throws(() => validateSavingsPeriod(month, now))
})

test('amounts reject missing, negative, non-finite and fractional inputs without coercing them to zero', () => {
  for (const amount of [null, undefined, '', ' ', '-1', NaN, Infinity, '1e4', '100.5', '100000001']) assert.throws(() => parseSavingsAmount(amount))
  assert.equal(parseSavingsAmount('10000'), 10000)
  assert.equal(parseSavingsAmount('0'), 0)
})

test('only member editors have access to the savings review route', () => {
  assert.equal(canOpenAdminRoute('/dashboard/savings-changes', ['EDIT_MEMBERS']), true)
  assert.equal(canOpenAdminRoute('/dashboard/savings-changes', ['VIEW_MEMBER_DATA']), false)
  assert.equal(canOpenAdminRoute('/dashboard/savings-changes', []), false)
})

test('each selected plan must meet the minimum, not just the combined total', () => {
  for (const [thrift, special] of [[1, 20000], [9999, 0], [20000, 9999], [0, 9999], [5000, 5000], [0, 0]]) {
    assert.throws(() => parseSavingsChangePlan(thrift, special), /10,000/)
  }
  for (const [thrift, special] of [[10000, 0], [0, 10000], [10000, 10000], [10001, 30000]]) {
    assert.deepEqual(parseSavingsChangePlan(thrift, special), { thrift, special })
  }
})
