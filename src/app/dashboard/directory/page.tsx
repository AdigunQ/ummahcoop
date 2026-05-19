import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { getCurrentMemberLiveDataset } from '@/lib/current-member-data'
import type { VoucherRow } from '@/lib/vouchers'

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

export default async function DirectoryPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
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

  const savingsPool = members.reduce((sum, member) => sum + member.monthlySavings + member.specialSavings, 0)
  const liveLabel = formatPeriodLabel(liveDataset.period)

  return (
    <div className="animate-fadeIn space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Update Member</h1>
          <p className="mt-1 text-gray-500">
            Showing the current live member data for {liveLabel}. April rows carry forward into May until fresh members are added.
          </p>
        </div>

        <Link
          href="/dashboard/directory/add"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Add new member
        </Link>
      </div>

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard label="Current Members" value={members.length.toString()} tone="blue" />
        <MetricCard label="With Thrift Savings" value={members.filter((m) => m.monthlySavings > 0).length.toString()} tone="green" />
        <MetricCard label="With Special Savings" value={members.filter((m) => m.specialSavings > 0).length.toString()} tone="amber" />
        <MetricCard label="Savings Pool" value={formatCurrency(savingsPool)} tone="purple" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px]">
          <thead className="bg-gray-50">
            <tr>
              <HeadCell label="Member" />
              <HeadCell label="Staff ID" />
              <HeadCell label="Type" />
              <HeadCell label="Thrift Savings" />
              <HeadCell label="Special Savings" />
              <HeadCell label="Monthly Charges" />
              <HeadCell label="New Member Fee" />
              <HeadCell label="Total" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={`${member.staffId}-${member.serial}`} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {member.memberId ? (
                    <Link
                      href={`/dashboard/directory/${member.memberId}`}
                      className="font-semibold text-gray-900 underline-offset-2 hover:underline"
                    >
                      {member.name || 'Unnamed Member'}
                    </Link>
                  ) : (
                    <span className="font-semibold text-gray-900">{member.name || 'Unnamed Member'}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-800">{member.staffId || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      member.memberType === 'NEW' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {member.memberType}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-800">{formatCurrency(member.monthlySavings)}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-800">{formatCurrency(member.specialSavings)}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-800">
                  {member.monthlyCharges > 0 ? formatCurrency(member.monthlyCharges) : '—'}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-800">
                  {member.newMemberFee > 0 ? formatCurrency(member.newMemberFee) : '—'}
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(member.totalSavings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    purple: 'border-purple-200 bg-purple-50 text-purple-800',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function HeadCell({ label }: { label: string }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</th>
}
