'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type PreviewResponse = {
  ok: boolean
  error?: string
  sheetName?: string
  globalWarnings?: string[]
  counts?: {
    members: number
    withSpecialSavings: number
    joinDates: number
    warningRows: number
  }
  sample?: Array<{
    staffId: string
    name: string
    monthlySavings: number
    specialSavings: number
    phone?: string
    joinedAt?: string
    warnings: string[]
  }>
}

export default function ImportMembersClient() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const canPreview = Boolean(file && !isLoading)
  const canReplace = Boolean(preview?.ok && confirmText === 'REPLACE MEMBERS' && !isLoading)

  const warningSummary = useMemo(() => {
    const counts = preview?.counts
    if (!counts) return null
    const warnings: string[] = []
    if (counts.warningRows > 0) warnings.push(`${counts.warningRows} row(s) with warnings`)
    if (counts.joinDates > 0) warnings.push(`${counts.joinDates} join dates detected`)
    return warnings
  }, [preview])

  async function post(mode: 'preview' | 'replace') {
    if (!file) {
      toast.error('Please upload the Excel file.')
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('mode', mode)
      formData.append('file', file)
      if (mode === 'replace') formData.append('confirm', confirmText)

      const res = await fetch('/api/admin/replace-members', {
        method: 'POST',
        body: formData,
      })

      const json = (await res.json()) as any
      if (!res.ok || !json?.ok) {
        const message = json?.error || 'Request failed'
        toast.error(message)
        if (mode === 'preview') setPreview({ ok: false, error: message })
        return
      }

      if (mode === 'preview') {
        setPreview(json as PreviewResponse)
        toast.success('Preview loaded')
        return
      }

      toast.success(`Imported ${json.createdMembers} members (deleted ${json.deletedMembers}).`)
      setPreview(null)
      setConfirmText('')
    } catch (err: any) {
      toast.error(err?.message || 'Unexpected error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <p className="font-semibold">Danger zone</p>
        <p className="mt-1 text-sm">
          This action will permanently delete all users with role <span className="font-mono">MEMBER</span> (including their loans,
          payments, withdrawals, transactions, vouchers, etc.) and replace them with the uploaded spreadsheet records.
        </p>
        <p className="mt-2 text-sm">
          Imported members are forced to <span className="font-semibold">OLD</span> member type for voucher fees.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">Members Excel File (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          <p className="mt-2 text-xs text-gray-500">
            Required columns: Employee No., Employee Name, Monthly Saving. Optional: Special Saving, Month Joined, Phone. If multiple
            sheets exist, the importer uses the most complete sheet (prefers “feb 2026”).
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canPreview}
            onClick={() => post('preview')}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Working…' : 'Preview Import'}
          </button>
          <Link
            href="/dashboard/directory"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Update Member
          </Link>
        </div>
      </div>

      {preview && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            {preview.error && <p className="mt-1 text-sm text-red-600">{preview.error}</p>}
            {preview.ok && preview.counts && (
              <p className="mt-1 text-sm text-gray-500">
                {preview.counts.members} members • {preview.counts.withSpecialSavings} with special savings
              </p>
            )}
            {preview.ok && preview.sheetName && (
              <p className="mt-1 text-xs text-gray-500">
                Source sheet: <span className="font-mono">{preview.sheetName}</span>
              </p>
            )}
          </div>

          {preview.ok && preview.counts && (
            <div className="grid grid-cols-2 gap-4 px-6 py-5 md:grid-cols-4">
              <Stat label="Members" value={preview.counts.members} />
              <Stat label="With special savings" value={preview.counts.withSpecialSavings} />
              <Stat label="Join dates" value={preview.counts.joinDates} />
              <Stat label="Warning rows" value={preview.counts.warningRows} />
            </div>
          )}

          {preview.ok && preview.globalWarnings && preview.globalWarnings.length > 0 && (
            <div className="px-6 pb-4 text-sm text-amber-700">
              Notes: {preview.globalWarnings.join(' • ')}
            </div>
          )}

          {warningSummary && warningSummary.length > 0 && (
            <div className="px-6 pb-4 text-sm text-amber-700">
              Warnings: {warningSummary.join(' • ')}
            </div>
          )}

          {preview.ok && preview.sample && preview.sample.length > 0 && (
            <div className="overflow-x-auto border-t border-gray-200">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Employee No.</th>
                    <th className="px-6 py-3">Employee Name</th>
                    <th className="px-6 py-3">Monthly Saving</th>
                    <th className="px-6 py-3">Special Savings</th>
                    <th className="px-6 py-3">Month Joined</th>
                    <th className="px-6 py-3">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.sample.map((row) => (
                    <tr key={row.staffId}>
                      <td className="px-6 py-3 font-medium text-gray-800">{row.staffId}</td>
                      <td className="px-6 py-3 text-gray-900">{row.name}</td>
                      <td className="px-6 py-3 text-gray-800">₦{Number(row.monthlySavings || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-gray-800">₦{Number(row.specialSavings || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-gray-700">{row.joinedAt || '—'}</td>
                      <td className="px-6 py-3 text-xs text-amber-700">
                        {row.warnings?.length ? row.warnings.join(' • ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-gray-200 px-6 py-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Confirm & Replace</p>
              <p className="mt-1 text-sm text-gray-600">
                Type <span className="font-mono">REPLACE MEMBERS</span> to enable the button.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="REPLACE MEMBERS"
                  className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
                <button
                  type="button"
                  disabled={!canReplace}
                  onClick={() => post('replace')}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? 'Working…' : 'Delete & Import Members'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  )
}
