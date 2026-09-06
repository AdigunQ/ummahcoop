'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { formatCurrency, getInitials } from '@/lib/utils'
import type { VoucherRow } from '@/lib/vouchers'
import { AdminDataTable } from '@/components/admin/admin-data-table'

type DirectoryRow = VoucherRow & { memberId: string | null }
export default function MemberDirectoryTable({ members }: { members: DirectoryRow[] }) {
  return (
    <AdminDataTable
      title="Member directory"
      note="Open a member to update their profile and recorded balances."
      categories={[
        { value: 'NEW', label: 'New members' },
        { value: 'OLD', label: 'Existing members' },
      ]}
      columns={[
        'Member',
        'Staff ID',
        'Member type',
        'Monthly Saving',
        'Special Saving',
        'Monthly Fee',
        'Form Fee',
        'Amount',
        'Manage',
      ]}
      rows={members.map((member) => ({
        key: `${member.staffId}-${member.serial}`,
        searchText: `${member.name} ${member.staffId} ${member.memberType}`,
        category: member.memberType,
        cells: [
          <div className="admin-person" key="member">
            <span className="admin-avatar">{getInitials(member.name)}</span>
            {member.memberId ? (
              <Link href={`/dashboard/directory/${member.memberId}`}>
                {member.name || 'Unnamed member'}
              </Link>
            ) : (
              <span>{member.name || 'Unnamed member'}</span>
            )}
          </div>,
          <span className="admin-staff-id" key="id">
            {member.staffId || 'Not set'}
          </span>,
          <span className="admin-tag" key="type">
            {member.memberType === 'NEW' ? 'New' : 'Existing'}
          </span>,
          formatCurrency(member.monthlySavings),
          formatCurrency(member.specialSavings),
          member.monthlyCharges > 0 ? formatCurrency(member.monthlyCharges) : '—',
          member.newMemberFee > 0 ? formatCurrency(member.newMemberFee) : '—',
          formatCurrency(member.totalSavings),
          member.memberId ? (
            <Link
              aria-label={`Edit ${member.name}`}
              className="admin-inline-link"
              href={`/dashboard/directory/${member.memberId}`}
              key="manage"
            >
              Edit
              <ArrowUpRight size={14} />
            </Link>
          ) : (
            'Not linked'
          ),
        ],
      }))}
    />
  )
}
