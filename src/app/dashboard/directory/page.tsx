import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { getCurrentMemberLiveDataset } from '@/lib/current-member-data'
import { UnscheduledMembers } from '@/components/admin/unscheduled-members'
import type { VoucherRow } from '@/lib/vouchers'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import MemberDirectoryTable from './member-directory-table'

type SearchParams = {
  deleted?: string
  deleteError?: string
}

type DirectoryRow = VoucherRow & {
  memberId: string | null
}

function normalizeStaffId(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function formatPeriodLabel(period: string): string {
  const match = period.trim().match(/^(20\d{2})-(0?[1-9]|1[0-2])$/)
  if (!match) return period

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month)) return period

  return new Date(year, month - 1, 1).toLocaleDateString('en-NG', {
    month: 'short',
    year: 'numeric',
  })
}

export default async function DirectoryPage({ searchParams: searchParamsInput }: { searchParams?: Promise<SearchParams> }) {
  const searchParams = await searchParamsInput

  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.EDIT_MEMBERS
    ))
  ) {
    redirect('/dashboard')
  }

  const [liveDataset, liveMembers] = await Promise.all([
    getCurrentMemberLiveDataset(),
    prisma.user.findMany({
      where: { role: 'MEMBER' },
      orderBy: [{ staffId: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        staffId: true,
      },
    }),
  ])

  const memberIdByStaffId = new Map(
    liveMembers
      .filter((member): member is { id: string; staffId: string | null } => Boolean(member.staffId))
      .map((member) => [normalizeStaffId(member.staffId as string), member.id])
  )

  const members: DirectoryRow[] = liveDataset.rows.map((row) => ({
    ...row,
    memberId: memberIdByStaffId.get(normalizeStaffId(row.staffId)) || null,
  }))

  const savingsPool = members.reduce(
    (sum, member) => sum + member.monthlySavings + member.specialSavings,
    0
  )
  const liveLabel = formatPeriodLabel(liveDataset.period)

  return (
    <div className="admin-page">
      <AdminHeading
        section="Members & data"
        title="Member directory"
        description={'Profiles and contribution plans for ' + liveLabel + '.'}
        actions={
          <Link href="/dashboard/directory/add" className="btn-primary">
            Add member
          </Link>
        }
      />
      <UnscheduledMembers members={liveDataset.unscheduledMembers} canEdit />
      {searchParams?.deleted === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Member deleted successfully.
        </div>
      )}

      {searchParams?.deleteError === '1' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not delete member. Please try again.
        </div>
      )}

      <AdminStats
        items={[
          {
            label: 'Current members',
            value: String(members.length + liveDataset.unscheduledMembers.length),
            note: liveDataset.unscheduledMembers.length
              ? `${liveDataset.unscheduledMembers.length} awaiting deductions` : undefined,
          },
          {
            label: 'Thrift savers',
            value: String(members.filter((m) => m.monthlySavings > 0).length),
          },
          {
            label: 'Special savers',
            value: String(members.filter((m) => m.specialSavings > 0).length),
          },
          { label: 'Monthly savings', value: formatCurrency(savingsPool) },
        ]}
      />
      <MemberDirectoryTable members={members} />
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'blue' | 'green' | 'amber' | 'purple'
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    purple: 'border-primary-200 bg-primary-50 text-primary-800',
  }

  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  )
}
