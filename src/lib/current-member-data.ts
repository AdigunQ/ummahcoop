import { prisma } from '@/lib/prisma'
import {
  buildVoucherDataset,
  firstVoucherPeriodForCreatedAt,
  resolveVoucherPeriod,
  type VoucherDataset,
  type VoucherRow,
} from '@/lib/vouchers'

export async function getLatestMemberDataMonth() {
  return prisma.memberDataMonth.findFirst({
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

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
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
  const monthlyCharges = isNew ? 0 : 100
  const newMemberFee = isNew ? 1000 : 0
  const memberFee = monthlyCharges + newMemberFee
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
  }
}

function rollForwardExistingRow(row: VoucherRow): VoucherRow {
  const monthlySavings = row.monthlySavings || 0
  const specialSavings = row.specialSavings || 0
  const monthlyCharges = 100
  const newMemberFee = 0
  const memberFee = monthlyCharges + newMemberFee
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

export async function getCurrentMemberLiveDataset(periodInput?: string): Promise<VoucherDataset> {
  const { period, start, end } = resolveVoucherPeriod(periodInput)
  const latestMonth = await getLatestMemberDataMonth()

  if (!latestMonth || latestMonth.period === period) {
    return buildVoucherDataset(period)
  }

  const baseDataset = await buildVoucherDataset(latestMonth.period)
  const carriedForwardRows = baseDataset.rows.map((row) => rollForwardExistingRow(row))
  const baseKeys = new Set(carriedForwardRows.map((row) => normalizeKey(row.staffId)))

  const members = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      status: 'ACTIVE',
      voucherEnabled: true,
      OR: [{ monthlyContribution: { gt: 0 } }, { specialContribution: { gt: 0 } }],
    },
    select: {
      name: true,
      staffId: true,
      monthlyContribution: true,
      specialContribution: true,
      createdAt: true,
    },
    orderBy: [{ staffId: 'asc' }, { name: 'asc' }],
  })

  const newMembers = members
    .filter((member) => !baseKeys.has(normalizeKey(member.staffId)))
    .map((member, index) => buildCurrentLiveRow(member, carriedForwardRows.length + index + 1, period))

  const rows = [...carriedForwardRows, ...newMembers]
  const totals = computeTotals(rows)

  return {
    period,
    start,
    end,
    rows,
    totals,
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
