import { prisma } from '@/lib/prisma'
import { calculateMemberFees } from '@/lib/member-fees'
import { getApprovedSavingsPlans } from '@/lib/contribution-plans'
import {
  buildVoucherDataset,
  firstVoucherPeriodForCreatedAt,
  resolveVoucherPeriod,
  type VoucherDataset,
  type VoucherRow,
} from '@/lib/vouchers'

export type UnscheduledMember = {
  id: string
  staffId: string | null
  name: string | null
  monthlyContribution: number
  specialContribution: number
  firstReportPeriod: string
  reason: 'SAVINGS_NOT_SET' | 'VOUCHER_DISABLED' | 'NEXT_PERIOD'
}

export type CurrentMemberDataset = VoucherDataset & { unscheduledMembers: UnscheduledMember[] }

export async function getLatestMemberDataMonth(period?: string) {
  return prisma.memberDataMonth.findFirst({
    where: period ? { period: { lte: period } } : undefined,
    orderBy: { period: 'desc' },
    select: {
      period: true,
      label: true,
      rowCount: true,
      uploadedAt: true,
    },
  })
}

export async function getCurrentMemberSnapshot() {
  const latestMonth = await getLatestMemberDataMonth()
  const dataset = await buildVoucherDataset(latestMonth?.period ?? resolveVoucherPeriod().period)

  return {
    latestMonth,
    dataset,
  }
}

export async function getCurrentMemberDataset() {
  const snapshot = await getCurrentMemberSnapshot()
  return snapshot.dataset
}

export async function getCurrentMemberReportDataset(periodInput?: string): Promise<VoucherDataset> {
  const { period } = resolveVoucherPeriod(periodInput)
  const currentPeriod = resolveVoucherPeriod().period

  if (period >= currentPeriod) {
    return getCurrentMemberLiveDataset(period)
  }

  return buildVoucherDataset(period)
}

export function normalizeMemberDataStaffId(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

function computeTotals(rows: VoucherRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.monthlySavings += row.monthlySavings
      acc.specialSavings += row.specialSavings
      acc.fees += row.memberFee
      acc.totalSavings += row.totalSavings
      if (row.memberType === 'NEW') acc.newMembers += 1
      else acc.oldMembers += 1
      return acc
    },
    { monthlySavings: 0, specialSavings: 0, fees: 0, totalSavings: 0, newMembers: 0, oldMembers: 0 }
  )
}

function buildCurrentLiveRow(
  member: {
    name: string | null
    staffId: string | null
    monthlyContribution: number | null
    specialContribution: number | null
    createdAt: Date
  },
  serial: number,
  period: string
): VoucherRow {
  const joinedPeriod = firstVoucherPeriodForCreatedAt(member.createdAt)
  const isNew = joinedPeriod === period
  const monthlySavings = member.monthlyContribution || 0
  const specialSavings = member.specialContribution || 0
  const { monthlyCharges, newMemberFee, memberFee } = calculateMemberFees(isNew)
  const totalSavings = monthlySavings + specialSavings + memberFee

  return {
    serial,
    staffId: member.staffId?.trim() || 'N/A',
    name: member.name?.trim() || 'Unnamed Member',
    monthlySavings,
    specialSavings,
    monthlyCharges,
    newMemberFee,
    memberFee,
    totalSavings,
    memberType: isNew ? 'NEW' : 'OLD',
    loanAmount: 0,
    commodityAmount: 0,
  }
}

function rollForwardExistingRow(row: VoucherRow): VoucherRow {
  const monthlySavings = row.monthlySavings || 0
  const specialSavings = row.specialSavings || 0
  const { monthlyCharges, newMemberFee, memberFee } = calculateMemberFees(false)
  const totalSavings = monthlySavings + specialSavings + memberFee

  return {
    ...row,
    monthlyCharges,
    newMemberFee,
    memberFee,
    totalSavings,
    memberType: 'OLD',
  }
}

export async function getCurrentMemberLiveDataset(periodInput?: string): Promise<CurrentMemberDataset> {
  const { period, start, end } = resolveVoucherPeriod(periodInput)
  const latestMonth = await getLatestMemberDataMonth(period)
  const baseDataset = latestMonth ? await buildVoucherDataset(latestMonth.period) : null
  const baseRows = !baseDataset ? [] : latestMonth?.period === period
    ? baseDataset.rows
    : baseDataset.rows.map(rollForwardExistingRow)
  const baseKeys = new Set(baseRows.map((row) => normalizeMemberDataStaffId(row.staffId)))

  const storedMembers = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      staffId: true,
      monthlyContribution: true,
      specialContribution: true,
      createdAt: true,
      voucherEnabled: true,
    },
    orderBy: [{ staffId: 'asc' }, { name: 'asc' }],
  })

  const plans = await getApprovedSavingsPlans(period, storedMembers.map(member => member.id), latestMonth?.period)
  const plansByStaffId = new Map(storedMembers.map(member => [normalizeMemberDataStaffId(member.staffId), plans.get(member.id)]))
  const effectiveBaseRows = baseRows.map(row => {
    const plan = plansByStaffId.get(normalizeMemberDataStaffId(row.staffId))
    return plan ? { ...row, monthlySavings: plan.requestedThrift, specialSavings: plan.requestedSpecial,
      totalSavings: row.totalSavings - row.monthlySavings - row.specialSavings + plan.requestedThrift + plan.requestedSpecial } : row
  })
  const members = storedMembers.map(member => {
    const plan = plans.get(member.id)
    return plan ? { ...member, monthlyContribution: plan.requestedThrift, specialContribution: plan.requestedSpecial } : member
  })

  const newMembers = members
    .filter((member) => !baseKeys.has(normalizeMemberDataStaffId(member.staffId)))
    .filter((member) => member.voucherEnabled && ((member.monthlyContribution || 0) > 0 || (member.specialContribution || 0) > 0))
    .filter((member) => firstVoucherPeriodForCreatedAt(member.createdAt) <= period)
    .map((member, index) => buildCurrentLiveRow(member, baseRows.length + index + 1, period))

  const rows = [...effectiveBaseRows, ...newMembers]
  const displayedKeys = new Set(rows.map((row) => normalizeMemberDataStaffId(row.staffId)))
  // Approval controls membership visibility; payroll eligibility must not hide accounts.
  const unscheduledMembers: UnscheduledMember[] = members
    .filter((member) => member.createdAt.toISOString().slice(0, 7) <= period)
    .filter((member) => !displayedKeys.has(normalizeMemberDataStaffId(member.staffId)))
    .map((member) => ({
      id: member.id,
      staffId: member.staffId,
      name: member.name,
      monthlyContribution: member.monthlyContribution || 0,
      specialContribution: member.specialContribution || 0,
      firstReportPeriod: firstVoucherPeriodForCreatedAt(member.createdAt),
      reason: !member.voucherEnabled ? 'VOUCHER_DISABLED'
        : (member.monthlyContribution || 0) <= 0 && (member.specialContribution || 0) <= 0
          ? 'SAVINGS_NOT_SET' : 'NEXT_PERIOD',
    }))
  const totals = computeTotals(rows)

  return {
    period,
    start,
    end,
    rows,
    totals,
    unscheduledMembers,
  }
}

export async function getMemberDataMonths() {
  return prisma.memberDataMonth.findMany({
    orderBy: { period: 'asc' },
    select: {
      period: true,
      label: true,
      rowCount: true,
      uploadedAt: true,
    },
  })
}
