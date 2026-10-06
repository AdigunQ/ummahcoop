import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { PrismaClient } from '@prisma/client'
import { UnscheduledMembers } from '../src/components/admin/unscheduled-members'
import { formatCurrency } from '../src/lib/utils'

type Member = {
  id: string
  staffId: string
  name: string
  role: string
  status: string
  voucherEnabled: boolean
  monthlyContribution: number
  specialContribution: number
  createdAt: Date
}
type Snapshot = { period: string; label: string; rows: Record<string, unknown>[]; columns: string[] }
let members: Member[] = []
const snapshots = new Map<string, Snapshot>()
const client = {
  savingsChangeRequest: { findMany: async () => [] },
  user: {
    findMany: async ({ where }: { where: { role?: string; status?: string; voucherEnabled?: boolean; OR?: unknown[] } }) =>
      members.filter(member => (!where.role || member.role === where.role)
        && (!where.status || member.status === where.status)
        && (where.voucherEnabled === undefined || member.voucherEnabled === where.voucherEnabled)
        && (!where.OR || member.monthlyContribution > 0 || member.specialContribution > 0)),
  },
  memberDataMonth: {
    findUnique: async ({ where }: { where: { period: string } }) => snapshots.get(where.period) ?? null,
    findFirst: async ({ where }: { where?: { period: { lte: string } } }) =>
      [...snapshots.values()].filter(month => !where || month.period <= where.period.lte)
        .sort((a, b) => b.period.localeCompare(a.period))[0] ?? null,
    findMany: async () => [...snapshots.values()].sort((a, b) => a.period.localeCompare(b.period)),
  },
}
// This fake has no write methods and cannot connect to any database.
;(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient
const dataModule = import('../src/lib/current-member-data')
const voucherModule = import('../src/lib/vouchers')

function reset() {
  snapshots.clear()
  members = []
}

function member(overrides: Partial<Member> = {}): Member {
  const record = {
    id: 'member-009709', staffId: '009709', name: 'Approved test member',
    role: 'MEMBER', status: 'ACTIVE', voucherEnabled: true,
    monthlyContribution: 50000, specialContribution: 0,
    createdAt: new Date('2026-10-05T00:00:00Z'), ...overrides,
  }
  members.push(record)
  return record
}

function snapshot(period = '2026-10') {
  const row = {
    'Employee No.': '000001', 'Employee Name': 'Saved member',
    Amount: 18900, Month: period, 'Monthly Saving': 10000, 'Special Saving': 5000,
    Loan: 2000, 'Management Fee': 500, Commodity: 300,
    'Monthly Fee': 100, 'Form Fee': 1000, Total: 18900,
  }
  snapshots.set(period, { period, label: period, rows: [row], columns: Object.keys(row) })
  return row
}

test('approval immediately adds a member to a current uploaded month without rewriting saved rows', async () => {
  reset()
  const saved = snapshot()
  const original = JSON.stringify(saved)
  const applicant = member({ status: 'PENDING' })
  const { getCurrentMemberLiveDataset } = await dataModule
  assert.equal((await getCurrentMemberLiveDataset('2026-10')).rows.length, 1)
  applicant.status = 'ACTIVE'
  const current = await getCurrentMemberLiveDataset('2026-10')
  assert.equal(current.rows.length, 2)
  assert.equal(current.rows[0].totalSavings, 18900)
  assert.equal(current.rows[0].loanAmount, 2000)
  assert.equal(current.rows[0].commodityAmount, 300)
  assert.equal(current.rows[1].staffId, '009709')
  assert.equal(current.rows[1].memberFee, 1100)
  assert.equal(current.rows[1].totalSavings, 51100)
  assert.deepEqual(await getCurrentMemberLiveDataset('2026-10'), current)
  assert.equal(JSON.stringify(saved), original)
})

test('approved members with no savings are visible but do not generate deductions', async () => {
  reset()
  const approved = member({ monthlyContribution: 0 })
  const { getCurrentMemberLiveDataset } = await dataModule
  const before = await getCurrentMemberLiveDataset('2026-10')
  assert.equal(before.rows.length, 0)
  assert.equal(before.unscheduledMembers[0].staffId, '009709')
  assert.equal(before.unscheduledMembers[0].reason, 'SAVINGS_NOT_SET')
  assert.equal(before.totals.fees, 0)
  assert.equal(before.totals.totalSavings, 0)
  approved.specialContribution = 20000
  const after = await getCurrentMemberLiveDataset('2026-10')
  assert.equal(after.unscheduledMembers.length, 0)
  assert.equal(after.rows.length, 1)
  assert.equal(after.rows[0].monthlySavings, 0)
  assert.equal(after.rows[0].specialSavings, 20000)
  assert.equal(after.rows[0].totalSavings, 21100)
})

test('voucher exclusions remain visible without enabling payroll or charging fees', async () => {
  reset()
  member({ voucherEnabled: false })
  const current = await (await dataModule).getCurrentMemberLiveDataset('2026-10')
  assert.equal(current.rows.length, 0)
  assert.equal(current.unscheduledMembers[0].reason, 'VOUCHER_DISABLED')
  assert.equal(current.totals.totalSavings, 0)
  assert.equal((await (await voucherModule).buildVoucherDataset('2026-10')).rows.length, 0)
})

test('late registrations are visible before their first payroll month without premature deductions', async () => {
  reset()
  member({ createdAt: new Date('2026-10-16T00:00:00Z') })
  const { getCurrentMemberLiveDataset } = await dataModule
  const october = await getCurrentMemberLiveDataset('2026-10')
  assert.equal(october.rows.length, 0)
  assert.equal(october.unscheduledMembers[0].reason, 'NEXT_PERIOD')
  assert.equal(october.unscheduledMembers[0].firstReportPeriod, '2026-11')
  const november = await getCurrentMemberLiveDataset('2026-11')
  assert.equal(november.unscheduledMembers.length, 0)
  assert.equal(november.rows[0].memberFee, 1100)
  assert.equal((await getCurrentMemberLiveDataset('2026-12')).rows[0].memberFee, 100)
})

test('the 15th remains eligible while the 16th starts the next month', async () => {
  reset()
  const approved = member({ createdAt: new Date('2026-10-15T23:59:59Z') })
  const { getCurrentMemberLiveDataset } = await dataModule
  assert.equal((await getCurrentMemberLiveDataset('2026-10')).rows.length, 1)
  approved.createdAt = new Date('2026-10-16T00:00:00Z')
  assert.equal((await getCurrentMemberLiveDataset('2026-10')).rows.length, 0)
})

test('pending, rejected and future accounts are not presented as current approved members', async () => {
  reset()
  member({ status: 'PENDING' })
  member({ id: 'rejected', staffId: '000002', status: 'REJECTED' })
  member({ id: 'admin', staffId: '000003', role: 'ADMIN' })
  member({ id: 'future', staffId: '000004', createdAt: new Date('2026-11-01T00:00:00Z') })
  const current = await (await dataModule).getCurrentMemberLiveDataset('2026-10')
  assert.equal(current.rows.length, 0)
  assert.equal(current.unscheduledMembers.length, 0)
})

test('future saved sheets never become the base for an earlier month', async () => {
  reset()
  snapshot('2026-09')
  const future = snapshot('2026-11')
  future['Monthly Saving'] = 900000
  member()
  const current = await (await dataModule).getCurrentMemberLiveDataset('2026-10')
  assert.equal(current.rows[0].monthlySavings, 10000)
  assert.equal(current.rows[0].memberFee, 100)
  assert.equal(current.rows.length, 2)
})

test('saved historical periods remain exact after later approvals', async () => {
  reset()
  snapshot('2026-08')
  const { buildVoucherDataset } = await voucherModule
  const original = await buildVoucherDataset('2026-08')
  member()
  await (await dataModule).getCurrentMemberLiveDataset('2026-10')
  assert.deepEqual(await buildVoucherDataset('2026-08'), original)
})

test('Staff ID normalization preserves zeros and prevents duplicate uploaded members', async () => {
  reset()
  const saved = snapshot()
  saved['Employee No.'] = ' 009 709 '
  member()
  const { getCurrentMemberLiveDataset, normalizeMemberDataStaffId } = await dataModule
  assert.equal(normalizeMemberDataStaffId(' 00a 123 '), '00A123')
  const current = await getCurrentMemberLiveDataset('2026-10')
  assert.equal(current.rows.length, 1)
  assert.equal(current.unscheduledMembers.length, 0)
})

test('awaiting-deductions list explains the reason and only offers edit links to editors', async () => {
  reset()
  member({ monthlyContribution: 0 })
  const { unscheduledMembers } = await (await dataModule).getCurrentMemberLiveDataset('2026-10')
  const readonly = renderToStaticMarkup(<UnscheduledMembers members={unscheduledMembers} />)
  assert.match(readonly, /009709/)
  assert.match(readonly, /Savings amount not set/)
  assert.doesNotMatch(readonly, /Update member/)
  const editable = renderToStaticMarkup(<UnscheduledMembers members={unscheduledMembers} canEdit />)
  assert.match(editable, /href="\/dashboard\/directory\/member-009709"/)
  assert.equal(renderToStaticMarkup(<UnscheduledMembers members={[]} />), '')
})

async function pageResult(period: string, canEdit = true) {
  const vouchers = await voucherModule
  const data = await dataModule
  const mocks: Record<string, unknown> = {
    'react/jsx-runtime': jsxRuntime,
    'next-auth/next': { getServerSession: async () => ({ user: { id: 'reviewer', email: 'reviewer@example.test', role: 'ADMIN' } }) },
    'next/navigation': { redirect: (url: string) => { throw new Error(`Redirect: ${url}`) } },
    'next/link': { default: 'a' },
    'lucide-react': { Upload: 'upload' },
    '@/components/admin/admin-ui': { AdminHeading: 'heading', AdminStats: 'stats' },
    '@/components/admin/period-picker': { PeriodPicker: 'period-picker' },
    '@/components/ui/ledger-table': { LedgerTable: 'ledger' },
    '@/components/admin/unscheduled-members': { UnscheduledMembers: 'unscheduled' },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: client },
    '@/lib/utils': { formatCurrency },
    '@/lib/vouchers': { ...vouchers, resolveVoucherPeriod: (input?: string) => vouchers.resolveVoucherPeriod(input || '2026-10') },
    '@/lib/current-member-data': data,
    '@/lib/access': { PRIVILEGE_CODES: { VIEW_MEMBER_DATA: 'view', EDIT_MEMBERS: 'edit' }, canAccessWithPrivileges: async (_: unknown, code: string) => code === 'view' || canEdit },
  }
  const source = readFileSync('src/app/dashboard/member-data/page.tsx', 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } }).outputText
  const exports: { default?: (args: unknown) => Promise<React.ReactElement> } = {}
  runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  } })
  return exports.default!({ searchParams: Promise.resolve({ period }) })
}

function componentProps(node: React.ReactNode, component: string): Record<string, any> {
  for (const item of React.Children.toArray(node)) {
    if (!React.isValidElement<{ children?: React.ReactNode }>(item)) continue
    if (item.type === component) return item.props
    const child = componentProps(item.props.children, component)
    if (Object.keys(child).length) return child
  }
  return {}
}

test('Member Data renders later approvals alongside an uploaded current month with every saved amount intact', async () => {
  reset()
  snapshot()
  member()
  const result = await pageResult('2026-10')
  const ledger = componentProps(result, 'ledger')
  assert.equal(ledger.rows.length, 2)
  for (const [column, amount] of [['Loan', 2000], ['Management Fee', 500], ['Commodity', 300], ['Total', 18900]] as const) {
    assert.equal(ledger.rows[0].cells[ledger.columns.indexOf(column)], formatCurrency(amount))
  }
  assert.equal(ledger.rows[1].cells[0], '009709')
  assert.equal(ledger.rows[1].cells[ledger.columns.indexOf('Monthly Fee')], formatCurrency(100))
  assert.equal(ledger.rows[1].cells[ledger.columns.indexOf('Form Fee')], formatCurrency(1000))
  assert.ok(componentProps(result, 'period-picker').options.some((option: { label: string }) => option.label.includes('(Live)')))
})

test('Member Data counts approved unscheduled members but excludes their plans from financial totals', async () => {
  reset()
  snapshot()
  member({ voucherEnabled: false })
  const result = await pageResult('2026-10', false)
  const stats = componentProps(result, 'stats').items
  assert.equal(stats[0].value, '2')
  assert.equal(stats[1].value, formatCurrency(15000))
  assert.equal(stats[2].value, formatCurrency(1100))
  assert.equal(componentProps(result, 'ledger').rows.length, 1)
  assert.equal(componentProps(result, 'unscheduled').members.length, 1)
  assert.equal(componentProps(result, 'unscheduled').canEdit, false)
})

test('Member Data does not append new approvals to a saved historical page', async () => {
  reset()
  snapshot('2026-08')
  member()
  const result = await pageResult('2026-08')
  assert.equal(componentProps(result, 'ledger').rows.length, 1)
  assert.equal(componentProps(result, 'unscheduled').members.length, 0)
})
