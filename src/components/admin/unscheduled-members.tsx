import Link from 'next/link'
import { AdminDataTable } from '@/components/admin/admin-data-table'
import { formatCurrency } from '@/lib/utils'
import type { UnscheduledMember } from '@/lib/current-member-data'

export function UnscheduledMembers({ members, canEdit = false }: {
  members: UnscheduledMember[]
  canEdit?: boolean
}) {
  if (!members.length) return null

  return (
    <AdminDataTable
      title="Approved members awaiting deductions"
      note="These accounts are approved and can sign in. They are not included in this month's deduction totals."
      columns={['Staff ID', 'Name', 'Thrift plan', 'Special plan', 'Why not scheduled', ...(canEdit ? ['Manage'] : [])]}
      rows={members.map((member) => ({
        key: member.id,
        searchText: `${member.staffId || ''} ${member.name || ''}`,
        cells: [
          member.staffId || 'Not set',
          member.name || 'Unnamed member',
          formatCurrency(member.monthlyContribution),
          formatCurrency(member.specialContribution),
          member.reason === 'SAVINGS_NOT_SET' ? 'Savings amount not set'
            : member.reason === 'VOUCHER_DISABLED' ? 'Excluded from vouchers'
              : `First deduction: ${member.firstReportPeriod}`,
          ...(canEdit ? [
            <Link key="edit" className="admin-inline-link" href={`/dashboard/directory/${member.id}`}>
              Update member
            </Link>,
          ] : []),
        ],
      }))}
    />
  )
}
