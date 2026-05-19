'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type MonthListItem = {
  period: string
  label: string
  rowCount: number
  uploadedAt: string
}

type PreviewMonth = {
  period: string
  label: string
  sheetName: string
  rowCount: number
  warnings: string[]
  sampleRows: Array<Record<string, unknown>>
}

type ListResponse = {
  ok: boolean
  error?: string
  months?: MonthListItem[]
}

type PreviewResponse = {
  ok: true
  mode: 'preview'
  columns: string[]
  months: PreviewMonth[]
  warnings: string[]
}

type ImportResponse = {
  ok: true
  mode: 'import'
  importedMonths: number
  importedRows: number
  syncedMembers?: number
  suspendedMembers?: number
  latestPeriod?: string | null
  months: Array<MonthListItem & { sheetName: string }>
  warnings: string[]
}

type ApiError = {
  ok: false
  error: string
}

const IMPORT_CONFIRM_TEXT = 'IMPORT MONTHLY DATA'

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
  return String(value)
}

export default function MonthlyMemberDataClient() {
  const [file, setFile] = useState<File | null>(null)
  const [months, setMonths] = useState<MonthListItem[]>([])
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [importResult, setImportResult] = useState<ImportResponse | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [action, setAction] = useState<'preview' | 'import' | null>(null)

  const canPreview = Boolean(file && !isLoading)
  const canImport = Boolean(preview && confirmText === IMPORT_CONFIRM_TEXT && !isLoading)

  const previewTotals = useMemo(() => {
    if (!preview) return { months: 0, rows: 0 }
    return {
      months: preview.months.length,
      rows: preview.months.reduce((sum, month) => sum + month.rowCount, 0),
    }
  }, [preview])

  async function refreshMonths() {
    try {
      const res = await fetch('/api/admin/member-data', { method: 'GET' })
      const json = (await res.json()) as ListResponse
      if (!res.ok || !json.ok) return
      setMonths(json.months || [])
    } catch {
      // ignore refresh failures
    }
  }

  useEffect(() => {
    refreshMonths()
  }, [])

  async function run(mode: 'preview' | 'import') {
    if (!file) {
      toast.error('Please choose an Excel workbook first.')
      return
    }

    setIsLoading(true)
    setAction(mode)
    if (mode === 'preview') {
      setPreview(null)
      setImportResult(null)
      setConfirmText('')
    }

    try {
      const formData = new FormData()
      formData.append('mode', mode)
      formData.append('file', file)

      const res = await fetch('/api/admin/member-data', {
        method: 'POST',
        body: formData,
      })

      const json = (await res.json()) as PreviewResponse | ImportResponse | ApiError
      if (!res.ok || !json.ok) {
        toast.error((json as ApiError).error || 'Upload failed')
        return
      }

      if (mode === 'preview') {
        const parsed = json as PreviewResponse
        setPreview(parsed)
        toast.success(`Preview ready: ${parsed.months.length} month(s), ${parsed.months.reduce((sum, m) => sum + m.rowCount, 0).toLocaleString()} rows.`)
        return
      }

      const imported = json as ImportResponse
      setImportResult(imported)
      toast.success(`Imported ${imported.importedMonths} month(s) and ${imported.importedRows.toLocaleString()} rows.`)
      await refreshMonths()
    } catch (err: any) {
      toast.error(err?.message || 'Unexpected error')
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Workbook (.xlsx, .xls)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null)
                setPreview(null)
                setImportResult(null)
                setConfirmText('')
              }}
              className="block w-full text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              Upload one workbook with multiple monthly sheets. Row 1 is treated as title, row 2 as headers, row 3 onward as member rows,
              and the totals row is auto-skipped. On import, monthly snapshots are saved and member fields are synced across the app.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canPreview}
              onClick={() => run('preview')}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && action === 'preview' ? 'Preparing Preview…' : 'Preview Workbook'}
            </button>
            <Link
              href="/dashboard/member-data"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Open Member Data
            </Link>
          </div>
        </div>
      </div>

      {preview && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Workbook Preview</h3>
            <p className="mt-1 text-sm text-gray-500">
              {previewTotals.months} month(s) detected • {previewTotals.rows.toLocaleString()} total row(s)
            </p>
            {preview.warnings.length > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Notes: the importer is normalizing joining-month charges and member fees to match the workbook rules.
                {preview.warnings.length > 0 ? ` ${preview.warnings.join(' • ')}` : ''}
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-3">Month</th>
                  <th className="px-6 py-3">Sheet</th>
                  <th className="px-6 py-3">Rows</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {preview.months.map((month) => (
                  <tr key={month.period}>
                    <td className="px-6 py-3 font-medium text-gray-900">{month.label}</td>
                    <td className="px-6 py-3 text-gray-700">{month.sheetName || '—'}</td>
                    <td className="px-6 py-3 text-gray-700">{month.rowCount.toLocaleString()}</td>
                    <td className="px-6 py-3 text-xs text-amber-700">{month.warnings.length ? month.warnings.slice(0, 2).join(' • ') : '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/dashboard/member-data?period=${encodeURIComponent(month.period)}`}
                        className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                      >
                        View Period
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-200 px-6 py-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Confirm Import</p>
              <p className="mt-1 text-sm text-gray-600">
                Type <span className="font-mono">{IMPORT_CONFIRM_TEXT}</span> to replace the uploaded monthly data and sync member records.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={IMPORT_CONFIRM_TEXT}
                  className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
                <button
                  type="button"
                  disabled={!canImport}
                  onClick={() => run('import')}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading && action === 'import' ? 'Importing…' : 'Import All Months'}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-5">
            <h4 className="text-sm font-semibold text-gray-900">Sample Rows</h4>
            <div className="mt-3 space-y-3">
              {preview.months.map((month) => (
                <details key={`${month.period}-sample`} className="rounded-lg border border-gray-200 bg-white">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-900">
                    {month.label} ({month.rowCount.toLocaleString()} rows)
                  </summary>
                  <div className="overflow-x-auto border-t border-gray-200">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          {preview.columns.map((col) => (
                            <th key={`${month.period}-${col}`} className="px-4 py-2">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {month.sampleRows.map((row, rowIndex) => (
                          <tr key={`${month.period}-sample-${rowIndex}`}>
                            {preview.columns.map((col) => (
                              <td key={`${month.period}-sample-${rowIndex}-${col}`} className="px-4 py-2 text-gray-800">
                                {formatCell(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}

      {importResult && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
          <p className="font-semibold">Import completed</p>
          <p className="mt-1 text-sm">
            Saved {importResult.importedMonths} month(s) with {importResult.importedRows.toLocaleString()} total row(s).
          </p>
          {(importResult.syncedMembers !== undefined || importResult.suspendedMembers !== undefined) && (
            <p className="mt-1 text-sm">
              Synced {importResult.syncedMembers ?? 0} active member record(s)
              {importResult.suspendedMembers !== undefined ? ` • Suspended ${importResult.suspendedMembers} non-imported active member(s)` : ''}.
            </p>
          )}
          {importResult.warnings.length > 0 && (
            <p className="mt-2 text-xs">Notes: {importResult.warnings.join(' • ')}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Uploaded Months</h3>
          <p className="mt-1 text-sm text-gray-500">Current snapshots available in the database.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3">Month</th>
                <th className="px-6 py-3">Rows</th>
                <th className="px-6 py-3">Last Upload</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {months.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={4}>
                    No uploaded month snapshots yet.
                  </td>
                </tr>
              ) : (
                months.map((month) => (
                  <tr key={month.period}>
                    <td className="px-6 py-3 font-medium text-gray-900">{month.label}</td>
                    <td className="px-6 py-3 text-gray-700">{month.rowCount.toLocaleString()}</td>
                    <td className="px-6 py-3 text-gray-700">{new Date(month.uploadedAt).toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/dashboard/member-data?period=${encodeURIComponent(month.period)}`}
                        className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
