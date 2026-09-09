import assert from 'node:assert/strict'
import test from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { calculateMemberFees } from '../src/lib/member-fees'

type SavedRow = Record<string, string | number>
const snapshots = new Map<string, SavedRow[]>()
let latestPeriod: string | null = null
let members: Array<{
  name: string
  staffId: string
  monthlyContribution: number
  specialContribution: number
  createdAt: Date
}> = []

// Read-only fakes keep fee regression tests completely off the real database.
const client = {
  user: { findMany: async () => members },
  memberDataMonth: {
    findUnique: async ({ where }: { where: { period: string } }) =>
      snapshots.has(where.period) ? { rows: snapshots.get(where.period) } : null,
    findFirst: async () => latestPeriod ? { period: latestPeriod } : null,
  },
}
;(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient
const vouchers = import('../src/lib/vouchers')
const liveData = import('../src/lib/current-member-data')

function reset() {
  snapshots.clear()
  latestPeriod = null
  members = [{
    name: 'New member test', staffId: '018525', monthlyContribution: 50000,
    specialContribution: 0, createdAt: new Date('2026-09-08T10:03:44Z'),
  }]
}

test('joining fees include both form fee and monthly charges, then only monthly charges', () => {
  assert.deepEqual(calculateMemberFees(true), { monthlyCharges: 100, newMemberFee: 1000, memberFee: 1100 })
  assert.deepEqual(calculateMemberFees(false), { monthlyCharges: 100, newMemberFee: 0, memberFee: 100 })
})

test('a newly registered member receives both fees even without an imported snapshot', async () => {
  reset()
  const { buildVoucherDataset } = await vouchers
  const current = await buildVoucherDataset('2026-09')
  assert.equal(current.rows[0].staffId, '018525')
  assert.equal(current.rows[0].memberType, 'NEW')
  assert.equal(current.rows[0].monthlySavings, 50000)
  assert.equal(current.rows[0].monthlyCharges, 100)
  assert.equal(current.rows[0].newMemberFee, 1000)
  assert.equal(current.rows[0].totalSavings, 51100)
  assert.equal(current.totals.fees, 1100)
  const next = await buildVoucherDataset('2026-10')
  assert.equal(next.rows[0].memberType, 'OLD')
  assert.equal(next.rows[0].newMemberFee, 0)
  assert.equal(next.rows[0].monthlyCharges, 100)
  assert.equal(next.rows[0].totalSavings, 50100)
})

test('thrift, special and combined plans retain all savings separately from fees', async () => {
  reset()
  const { buildVoucherDataset } = await vouchers
  for (const [thrift, special] of [[50000, 0], [0, 20000], [10000, 5000]]) {
    members[0].monthlyContribution = thrift
    members[0].specialContribution = special
    const { rows } = await buildVoucherDataset('2026-09')
    assert.equal(rows[0].monthlySavings, thrift)
    assert.equal(rows[0].specialSavings, special)
    assert.equal(rows[0].totalSavings, thrift + special + 1100)
  }
})

test('live roll-forward adds new-member fees once without changing saved August rows', async () => {
  reset()
  latestPeriod = '2026-08'
  const oldRow = { 'Staff ID': '000001', Name: 'Existing member', 'Thrift Savings': 10000,
    'Special Savings': 5000, Charges: 100, 'New Member Fee': 0, Total: 15100 }
  snapshots.set(latestPeriod, [oldRow])
  const before = JSON.stringify(oldRow)
  const { getCurrentMemberLiveDataset } = await liveData
  const current = await getCurrentMemberLiveDataset('2026-09')
  assert.equal(current.rows.length, 2)
  assert.equal(current.rows.find(row => row.staffId === '018525')?.totalSavings, 51100)
  assert.equal(current.totals.fees, 1200)
  assert.deepEqual(await getCurrentMemberLiveDataset('2026-09'), current)
  const next = await getCurrentMemberLiveDataset('2026-10')
  assert.equal(next.rows.find(row => row.staffId === '018525')?.newMemberFee, 0)
  assert.equal(next.rows.find(row => row.staffId === '018525')?.totalSavings, 50100)
  assert.equal(JSON.stringify(oldRow), before)
})

test('historical saved fees and totals are preserved even when Month Joined is present', async () => {
  reset()
  const row = { 'Staff ID': '000002', Name: 'Historical member', 'Thrift Savings': 20000,
    'Special Savings': 5000, Charges: 0, 'New Member Fee': 1000, Total: 27000,
    Loan: 500, Commodity: 500, 'Month Joined': 'Feb-2026' }
  snapshots.set('2026-02', [row])
  const { rows } = await (await vouchers).buildVoucherDataset('2026-02')
  assert.equal(rows[0].monthlyCharges, 0)
  assert.equal(rows[0].newMemberFee, 1000)
  assert.equal(rows[0].totalSavings, 27000)
  assert.equal(rows[0].loanAmount, 500)
  assert.equal(rows[0].commodityAmount, 500)
})

test('a saved joining row with both fees is preserved without charging either fee twice', async () => {
  reset()
  snapshots.set('2026-09', [{ 'Staff ID': '018525', Name: 'New member test',
    'Thrift Savings': 50000, Charges: 100, 'New Member Fee': 1000, Total: 51100,
    'Month Joined': 'Sep-2026' }])
  const { rows } = await (await vouchers).buildVoucherDataset('2026-09')
  assert.equal(rows[0].memberFee, 1100)
  assert.equal(rows[0].totalSavings, 51100)
})

test('members after the existing voucher cutoff are not charged before their first period', async () => {
  reset()
  members[0].createdAt = new Date('2026-09-16T00:00:00Z')
  const { buildVoucherDataset } = await vouchers
  assert.equal((await buildVoucherDataset('2026-09')).rows.length, 0)
  assert.equal((await buildVoucherDataset('2026-10')).rows[0].memberFee, 1100)
  latestPeriod = '2026-08'
  snapshots.set(latestPeriod, [{ 'Staff ID': '000001', Name: 'Existing member', 'Thrift Savings': 10000, Charges: 100, Total: 10100 }])
  const { getCurrentMemberLiveDataset } = await liveData
  assert.equal((await getCurrentMemberLiveDataset('2026-09')).rows.length, 1)
  assert.equal((await getCurrentMemberLiveDataset('2026-10')).rows.find(row => row.staffId === '018525')?.memberFee, 1100)
})
