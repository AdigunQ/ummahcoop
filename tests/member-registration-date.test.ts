import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMemberRegistrationDate, registrationDateInputValue } from '../src/lib/member-registration-date'
import { hasLoanTenureElapsed } from '../src/lib/loan-request'

const now = new Date('2026-09-09T12:00:00Z')

test('a late-entered member retains their actual registration date', () => {
  assert.equal(parseMemberRegistrationDate('2026-08-12', now)?.toISOString(), '2026-08-12T00:00:00.000Z')
  assert.equal(parseMemberRegistrationDate('2025-10-01', now)?.toISOString(), '2025-10-01T00:00:00.000Z')
})

test('registration dates reject empty, malformed, impossible and future dates', () => {
  for (const input of [null, undefined, '', ' ', 20260812, '12/08/2026', '2026-8-12', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-08-00', '2026-09-10', '2026-08-12T12:00:00Z']) {
    assert.equal(parseMemberRegistrationDate(input, now), null, String(input))
  }
})

test('valid leap days and month boundaries preserve the exact date', () => {
  for (const input of ['2024-02-29', '2026-01-01', '2026-08-31', '2026-09-09']) {
    assert.equal(parseMemberRegistrationDate(input, now)?.toISOString(), `${input}T00:00:00.000Z`)
  }
})

test('today and future-date validation use Nigerian time even near midnight UTC', () => {
  const lateUtc = new Date('2026-09-09T23:30:00Z')
  assert.equal(registrationDateInputValue(lateUtc), '2026-09-10')
  assert.ok(parseMemberRegistrationDate('2026-09-10', lateUtc))
  assert.equal(parseMemberRegistrationDate('2026-09-11', lateUtc), null)
  assert.equal(registrationDateInputValue(new Date('2026-12-31T23:30:00Z')), '2027-01-01')
})

test('actual registration dates still require six complete months for loan tenure', () => {
  assert.equal(hasLoanTenureElapsed(parseMemberRegistrationDate('2026-03-09', now)!, now), true)
  assert.equal(hasLoanTenureElapsed(parseMemberRegistrationDate('2026-03-10', now)!, now), false)
  assert.equal(hasLoanTenureElapsed(parseMemberRegistrationDate('2026-08-12', now)!, now), false)
})
