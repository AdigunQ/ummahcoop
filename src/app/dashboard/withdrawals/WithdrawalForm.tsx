'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { submitWithdrawalRequest } from './actions'
import toast from 'react-hot-toast'

export default function WithdrawalForm({ member }: { member: any }) {
  const specialBalance = member.specialBalance || 0
  const isOctober = useMemo(() => new Date().getMonth() === 9, [])

  async function handleSubmit(formData: FormData) {
    const res = await submitWithdrawalRequest(formData)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success('Special savings withdrawal request submitted.')
    }
  }

  return (
    <form action={handleSubmit} className="mt-6 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Special savings only</p>
        <p className="mt-2 text-sm text-slate-700">
          Special savings can be withdrawn in October only. Thrift savings withdrawals are handled through full membership closure.
        </p>
        <p className="mt-3 text-base font-semibold text-slate-900">
          Available balance: {formatCurrency(specialBalance)}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
        <textarea
          name="reason"
          rows={3}
          placeholder="Optional note for admin review"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
        />
      </div>

      <input type="hidden" name="source" value="SPECIAL_SAVINGS" />

      <button
        type="submit"
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        disabled={!isOctober || specialBalance <= 0}
      >
        {isOctober ? 'Request full special savings withdrawal' : 'Available in October only'}
      </button>
    </form>
  )
}
