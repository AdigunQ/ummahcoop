import assert from 'node:assert/strict'
import { before, beforeEach, after, test } from 'node:test'
import { PrismaClient } from '@prisma/client'

// Opt-in integration tests. The URL guard forbids remote and ordinary local databases.
const url = process.env.SAVINGS_TEST_DATABASE_URL
const integration = (name: string, run: () => Promise<void>) => test(name, { skip: !url }, run)
let db: PrismaClient
let service: typeof import('../src/lib/savings-change-requests')
let plans: typeof import('../src/lib/contribution-plans')
let datasets: typeof import('../src/lib/current-member-data')
let vouchers: typeof import('../src/lib/vouchers')
const now = new Date('2026-10-06T12:00:00Z')
const input = { thrift: '10000', special: '8000', requestedPeriod: '2026-11' }

before(async () => {
  if (!url) return
  const parsed = new URL(url)
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.pathname === '/ummah_savings_test', 'Integration tests require the isolated loopback test database')
  db = new PrismaClient({ datasourceUrl: url })
  ;(globalThis as unknown as { prisma: PrismaClient }).prisma = db
  service = await import('../src/lib/savings-change-requests')
  plans = await import('../src/lib/contribution-plans')
  datasets = await import('../src/lib/current-member-data')
  vouchers = await import('../src/lib/vouchers')
})
after(async () => { if (db) await db.$disconnect() })

beforeEach(async () => {
  if (!url) return
  await db.savingsChangeRequest.deleteMany()
  await db.payrollLine.deleteMany()
  await db.payrollCycle.deleteMany()
  await db.voucher.deleteMany()
  await db.memberDataMonth.deleteMany()
  await db.memberPrivilege.deleteMany()
  await db.user.deleteMany()
  await db.user.createMany({ data: [
    { id: 'member', name: 'Savings Test Member', staffId: '009709', email: 'member@example.test', role: 'MEMBER', status: 'ACTIVE', monthlyContribution: 20000, specialContribution: 5000, balance: 100000, specialBalance: 40000, totalContributions: 140000, createdAt: new Date('2025-10-01') },
    { id: 'other', name: 'Other Test Member', staffId: '000002', email: 'other@example.test', role: 'MEMBER', status: 'ACTIVE', monthlyContribution: 30000, createdAt: new Date('2025-10-01') },
    { id: 'manager', name: 'Member Editor', staffId: '000003', email: 'editor@example.test', role: 'MEMBER', status: 'ACTIVE' },
    { id: 'viewer', name: 'Read Only Exco', staffId: '000004', email: 'viewer@example.test', role: 'MEMBER', status: 'ACTIVE' },
    { id: 'admin', name: 'Test Developer', email: 'admin@example.test', role: 'ADMIN', status: 'ACTIVE' },
  ] })
  await db.memberPrivilege.createMany({ data: [
    { userId: 'manager', code: 'EDIT_MEMBERS' }, { userId: 'viewer', code: 'VIEW_MEMBER_DATA' },
  ] })
  await db.memberDataMonth.create({ data: {
    period: '2026-10', label: 'Oct 2026', rowCount: 1,
    columns: ['Staff ID', 'Name', 'Thrift Savings', 'Special Savings', 'Charges', 'Total'],
    rows: [{ 'Staff ID': '009709', Name: 'Savings Test Member', 'Thrift Savings': 20000, 'Special Savings': 5000, Charges: 100, Total: 25100 }],
  } })
  await db.voucher.create({ data: { userId: 'member', fullName: 'Savings Test Member', staffId: '009709', department: 'Test', monthlyDeduction: 25000, effectiveStartDate: new Date('2026-10-01') } })
})

async function financialState() {
  return {
    members: await db.user.findMany({ orderBy: { id: 'asc' } }),
    sheets: await db.memberDataMonth.findMany({ orderBy: { period: 'asc' } }),
    vouchers: await db.voucher.findMany({ orderBy: { id: 'asc' } }),
    transactions: await db.transaction.count(),
  }
}

async function approve(requestId: string, effectivePeriod = '2026-11', reviewer = 'manager', at = now) {
  return service.reviewSavingsChange(reviewer, { requestId, decision: 'approve', effectivePeriod, note: 'Agreed with member' }, at)
}

integration('request -> review -> effective month keeps every stored balance, sheet and voucher unchanged', async () => {
  const before = await financialState()
  const request = await service.requestSavingsChange('member', input, now)
  assert.equal(request.status, 'PENDING')
  assert.equal(request.previousThrift, 20000)
  assert.equal(request.previousSpecial, 5000)
  assert.deepEqual(await financialState(), before)
  await approve(request.id)
  assert.deepEqual(await financialState(), before)
  const stored = await db.savingsChangeRequest.findUniqueOrThrow({ where: { id: request.id } })
  assert.equal(stored.reviewedById, 'manager')
  assert.equal(stored.effectivePeriod, '2026-11')
  const october = await datasets.getCurrentMemberLiveDataset('2026-10')
  const november = await datasets.getCurrentMemberLiveDataset('2026-11')
  const december = await datasets.getCurrentMemberLiveDataset('2026-12')
  assert.equal(october.rows.find(row => row.staffId === '009709')!.monthlySavings, 20000)
  for (const dataset of [november, december]) {
    const row = dataset.rows.find(row => row.staffId === '009709')!
    assert.equal(row.monthlySavings, 10000)
    assert.equal(row.specialSavings, 8000)
    assert.equal(row.memberFee, 100)
    assert.equal(row.totalSavings, 18100)
  }
  assert.equal((await vouchers.buildVoucherDataset('2026-11')).rows.find(row => row.staffId === '009709')!.monthlySavings, 10000)
  assert.deepEqual(await financialState(), before)
})

integration('unapproved amounts never appear in deductions or the member overview', async () => {
  await service.requestSavingsChange('member', input, now)
  const member = await db.user.findUniqueOrThrow({ where: { id: 'member' } })
  assert.equal((await plans.resolveContributionPlans([member], '2026-11'))[0].monthlyContribution, 20000)
  assert.equal((await datasets.getCurrentMemberLiveDataset('2026-11')).rows.find(row => row.staffId === '009709')!.monthlySavings, 20000)
})

integration('read-only excos and ordinary members cannot approve a request', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  for (const reviewer of ['viewer', 'other', 'not-a-user']) await assert.rejects(approve(request.id, '2026-11', reviewer), /permission/)
  assert.equal((await db.savingsChangeRequest.findUniqueOrThrow({ where: { id: request.id } })).status, 'PENDING')
})

integration('privileged members cannot approve their own requests', async () => {
  const request = await service.requestSavingsChange('manager', input, now)
  await assert.rejects(approve(request.id, '2026-11', 'manager'), /Another authorised admin/)
  await approve(request.id, '2026-11', 'admin')
})

integration('suspended applicants and reviewers cannot change deductions', async () => {
  await db.user.update({ where: { id: 'member' }, data: { status: 'SUSPENDED' } })
  await assert.rejects(service.requestSavingsChange('member', input, now), /active members/)
  await db.user.update({ where: { id: 'member' }, data: { status: 'ACTIVE' } })
  const request = await service.requestSavingsChange('member', input, now)
  await db.user.update({ where: { id: 'manager' }, data: { status: 'SUSPENDED' } })
  await assert.rejects(approve(request.id), /permission/)
  await db.user.update({ where: { id: 'member' }, data: { status: 'SUSPENDED' } })
  await assert.rejects(approve(request.id, '2026-11', 'admin'), /active members/)
})

integration('only the owner can cancel and only before review', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  await assert.rejects(service.cancelSavingsChange('other', request.id), /does not belong/)
  await service.cancelSavingsChange('member', request.id)
  await assert.rejects(approve(request.id), /reviewed or cancelled/)
  assert.equal((await db.savingsChangeRequest.findUniqueOrThrow({ where: { id: request.id } })).status, 'CANCELLED')
})

integration('a declined request preserves deductions and permits a new request', async () => {
  const before = await financialState()
  const request = await service.requestSavingsChange('member', input, now)
  await service.reviewSavingsChange('manager', { requestId: request.id, decision: 'reject', effectivePeriod: '', note: 'Please contact the office' }, now)
  assert.deepEqual(await financialState(), before)
  assert.ok(await service.requestSavingsChange('member', input, now))
})

integration('repeated decisions cannot reverse approval or create additional changes', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  await approve(request.id)
  await assert.rejects(approve(request.id), /reviewed or cancelled/)
  await assert.rejects(service.cancelSavingsChange('member', request.id), /reviewed or cancelled/)
  await assert.rejects(service.reviewSavingsChange('admin', { requestId: request.id, decision: 'reject', effectivePeriod: '' }, now), /reviewed or cancelled/)
  assert.equal(await db.savingsChangeRequest.count({ where: { status: 'APPROVED' } }), 1)
})

integration('simultaneous submissions leave exactly one pending request', async () => {
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.requestSavingsChange('member', input, now)))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(await db.savingsChangeRequest.count({ where: { userId: 'member', status: 'PENDING' } }), 1)
})

integration('simultaneous approvals commit only one decision and never change balances', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  const before = await financialState()
  const results = await Promise.allSettled([approve(request.id), approve(request.id, '2026-12', 'admin')])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.deepEqual(await financialState(), before)
})

integration('scheduled changes prevent conflicting requests until they take effect', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  await approve(request.id)
  await assert.rejects(service.requestSavingsChange('member', { ...input, thrift: '12000' }, now), /pending or scheduled/)
  const next = await service.requestSavingsChange('member', { ...input, thrift: '12000', requestedPeriod: '2026-12' }, new Date('2026-11-02T12:00:00Z'))
  assert.equal(next.previousThrift, 10000)
  assert.equal(next.previousSpecial, 8000)
})

integration('amount validation rejects empty, zero-total, negative, huge and unchanged plans', async () => {
  for (const amounts of [{ thrift: '', special: '1000' }, { thrift: '-1', special: '1000' }, { thrift: '0', special: '0' }, { thrift: '100000001', special: '0' }, { thrift: '20000', special: '5000' }]) {
    await assert.rejects(service.requestSavingsChange('member', { ...input, ...amounts }, now))
  }
  assert.equal(await db.savingsChangeRequest.count(), 0)
})

integration('admins cannot backdate or bring forward a member-requested start month', async () => {
  const request = await service.requestSavingsChange('member', { ...input, requestedPeriod: '2026-12' }, now)
  await assert.rejects(approve(request.id, '2026-10'), /next month/)
  await assert.rejects(approve(request.id, '2026-11'), /earlier/)
  await approve(request.id, '2027-01')
})

integration('approval rechecks the calendar after a pending request becomes stale', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  await assert.rejects(approve(request.id, '2026-11', 'manager', new Date('2026-11-02')), /next month/)
  await approve(request.id, '2026-12', 'manager', new Date('2026-11-02'))
})

integration('uploaded future sheets and prepared payroll periods cannot be rewritten by approval', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  await db.payrollCycle.create({ data: { period: '2026-11', status: 'DRAFT' } })
  await assert.rejects(approve(request.id), /already been prepared/)
  await db.payrollCycle.deleteMany()
  await db.memberDataMonth.create({ data: { period: '2026-11', label: 'Nov', columns: [], rows: [], rowCount: 0 } })
  await assert.rejects(approve(request.id), /existing uploaded records/)
  assert.equal((await db.savingsChangeRequest.findUniqueOrThrow({ where: { id: request.id } })).status, 'PENDING')
})

integration('thrift-only and special-only plans both flow through future reports', async () => {
  const request = await service.requestSavingsChange('member', { ...input, thrift: '0', special: '15000' }, now)
  await approve(request.id)
  const projected = (await vouchers.buildVoucherDataset('2026-11')).rows.find(row => row.staffId === '009709')!
  assert.equal(projected.monthlySavings, 0)
  assert.equal(projected.specialSavings, 15000)
  const member = await db.user.findUniqueOrThrow({ where: { id: 'member' } })
  assert.equal((await plans.resolveContributionPlans([member], '2026-10'))[0].monthlyContribution, 20000)
  assert.equal((await plans.resolveContributionPlans([member], '2026-11'))[0].specialContribution, 15000)
})

integration('payroll generation and approval cannot race into different monthly amounts', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  const { ensureCycleDraft } = await import('../src/lib/payroll')
  await Promise.allSettled([approve(request.id), ensureCycleDraft('2026-11')])
  await ensureCycleDraft('2026-11')
  const decision = await db.savingsChangeRequest.findUniqueOrThrow({ where: { id: request.id } })
  const line = await db.payrollLine.findFirstOrThrow({ where: { userId: 'member', lineType: 'SAVINGS', cycle: { period: '2026-11' } } })
  assert.equal(line.expectedAmount, decision.status === 'APPROVED' ? 10000 : 20000)
  const oldLine = { ...line }
  await ensureCycleDraft('2026-11')
  assert.deepEqual(await db.payrollLine.findUnique({ where: { id: line.id } }), oldLine)
})

integration('database constraint also blocks duplicate pending requests', async () => {
  const request = await service.requestSavingsChange('member', input, now)
  const { id, createdAt, updatedAt, ...data } = request
  await assert.rejects(db.savingsChangeRequest.create({ data }), (error: any) => error.code === 'P2002')
  assert.equal(await db.savingsChangeRequest.count(), 1)
})
