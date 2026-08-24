'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { VoucherRow } from '@/lib/vouchers'

type DirectoryRow = VoucherRow & {
  memberId: string | null
}

export default function MemberDirectoryTable({ members }: { members: DirectoryRow[] }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const filteredMembers = useMemo(() => {
    if (!normalizedQuery) return members

    return members.filter((member) =>
      [member.name, member.staffId, member.memberType]
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    )
  }, [members, normalizedQuery])

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Member records</h2>
          <p className="mt-1 text-xs text-gray-500">Search by member name or Staff ID.</p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <label htmlFor="member-directory-search" className="sr-only">Search members</label>
          <input
            id="member-directory-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or Staff ID"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 text-xs text-gray-500">
        <span>
          Showing <span className="font-semibold text-gray-800">{filteredMembers.length}</span> of {members.length} members
        </span>
        {query && (
          <button type="button" onClick={() => setQuery('')} className="font-semibold text-primary-600 hover:text-primary-700">
            Clear search
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead className="bg-gray-50">
            <tr>
              <HeadCell label="Employee No." />
              <HeadCell label="Employee Name" />
              <HeadCell label="Member Type" />
              <HeadCell label="Monthly Saving" />
              <HeadCell label="Special Saving" />
              <HeadCell label="Monthly Fee" />
              <HeadCell label="Form Fee" />
              <HeadCell label="Amount" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                  No members match &quot;{query}&quot;.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={`${member.staffId}-${member.serial}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{member.staffId || 'N/A'}</td>
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
                    {member.monthlyCharges > 0 ? formatCurrency(member.monthlyCharges) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {member.newMemberFee > 0 ? formatCurrency(member.newMemberFee) : '-'}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(member.totalSavings)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HeadCell({ label }: { label: string }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</th>
}
