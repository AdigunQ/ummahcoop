'use client'

import { useState } from 'react'
import { CalendarDays, HandCoins, Landmark, Pencil, Save, X } from 'lucide-react'
import { updateProfile } from './actions'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'

type MemberProfile = {
  name: string | null
  email: string
  phone: string | null
  staffId: string | null
  department: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  createdAt: string
  totalContributions: number
  loanRequestedAmount: number
  loanRequestedCount: number
}

export default function ProfileView({ member }: { member: MemberProfile }) {
  const [isEditingBank, setIsEditingBank] = useState(false)
  const [isEditingPhone, setIsEditingPhone] = useState(false)

  async function handleSave(formData: FormData) {
    const res = await updateProfile(formData)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success('Profile updated successfully')
      setIsEditingBank(false)
      setIsEditingPhone(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Member snapshot</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Joined, contributions, and loans</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <StatCard
            icon={CalendarDays}
            label="Joined date"
            value={formatDate(member.createdAt)}
            note="When membership started"
          />
          <StatCard
            icon={Landmark}
            label="Contributed so far"
            value={formatCurrency(member.totalContributions)}
            note="Thrift and special savings"
          />
          <StatCard
            icon={HandCoins}
            label="Loan requested"
            value={formatCurrency(member.loanRequestedAmount)}
            note={
              member.loanRequestedCount > 0
                ? `${member.loanRequestedCount} request${member.loanRequestedCount === 1 ? '' : 's'} so far`
                : 'No loan requests yet'
            }
          />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
      {/* Personal Info Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <span className="text-gray-500">Name</span>
            <span className="col-span-2 font-medium text-gray-900">{member.name || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <span className="text-gray-500">Email</span>
            <span className="col-span-2 font-medium text-gray-900">{member.email}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <span className="text-gray-500">Staff ID</span>
            <span className="col-span-2 font-medium text-gray-900">{member.staffId || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <span className="text-gray-500">Department</span>
            <span className="col-span-2 font-medium text-gray-900">{member.department || 'N/A'}</span>
          </div>

          {/* Editable Phone */}
          <form action={handleSave} className="border-t border-gray-100 pt-4">
            <div className="grid grid-cols-3 gap-2 text-sm items-center">
              <span className="text-gray-500">Phone</span>
              {isEditingPhone ? (
                <div className="col-span-2 flex gap-2">
                  <input
                    name="phone"
                    defaultValue={member.phone || ''}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    required
                  />
                  <button type="submit" className="text-green-600 hover:text-green-700">
                    <Save size={16} />
                  </button>
                  <button type="button" onClick={() => setIsEditingPhone(false)} className="text-red-500 hover:text-red-600">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="col-span-2 flex items-center justify-between">
                  <span className="font-medium text-gray-900">{member.phone || 'N/A'}</span>
                  <button type="button" onClick={() => setIsEditingPhone(true)} className="text-primary-600 hover:text-primary-700">
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Bank Details Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Bank Details</h2>
          {!isEditingBank && (
            <button
              onClick={() => setIsEditingBank(true)}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Pencil size={14} /> Edit
            </button>
          )}
        </div>

        {isEditingBank ? (
          <form action={handleSave} className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Bank Name</label>
              <input
                name="bankName"
                defaultValue={member.bankName || ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Account Number</label>
              <input
                name="bankAccountNumber"
                defaultValue={member.bankAccountNumber || ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Account Name</label>
              <input
                name="bankAccountName"
                defaultValue={member.bankAccountName || ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditingBank(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500">Bank</span>
              <span className="col-span-2 font-medium text-gray-900">{member.bankName || 'Not Set'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500">Account No</span>
              <span className="col-span-2 font-medium text-gray-900 font-mono">{member.bankAccountNumber || 'Not Set'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <span className="text-gray-500">Acct Name</span>
              <span className="col-span-2 font-medium text-gray-900">{member.bankAccountName || 'Not Set'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: any
  label: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </div>
  )
}
