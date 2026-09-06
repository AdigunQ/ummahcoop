'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileSpreadsheet, Upload, ArrowRight, ArrowUpRight, Check, RotateCcw } from 'lucide-react'
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
  validation: {
    template: 'combined' | 'legacy' | 'mixed'
    isAbanoStandard: boolean
    issues: string[]
  }
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
  validation: {
    template: 'combined' | 'legacy' | 'mixed'
    isAbanoStandard: boolean
    issues: string[]
  }
}

function templateBadge(validation: PreviewResponse['validation']): {
  label: string
  tone: 'green' | 'yellow' | 'red'
} {
  if (validation.template === 'combined' && validation.isAbanoStandard) {
    return { label: 'ABano Standard (Combined) detected', tone: 'green' }
  }

  if (validation.template === 'combined') {
    return { label: 'Combined format detected (not fully standard)', tone: 'yellow' }
  }

  if (validation.template === 'legacy') {
    return { label: 'Legacy template detected', tone: 'yellow' }
  }

  return { label: 'Mixed/unsupported workbook format', tone: 'red' }
}


type ApiError = {
  ok: false
  error: string
}

const IMPORT_CONFIRM_TEXT = 'IMPORT MONTHLY DATA'

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number')
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
  return String(value)
}

export default function MonthlyMemberDataClient() {
  const [selectedMonth, setSelectedMonth] = useState('')
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [months, setMonths] = useState<MonthListItem[]>([])
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [importResult, setImportResult] = useState<ImportResponse | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [action, setAction] = useState<'preview' | 'import' | null>(null)
  const [lastSource, setLastSource] = useState<'upload' | 'server'>('upload')

  const canUploadPreview = Boolean(file && !isLoading)
  const canServerPreview = !isLoading
  const canImport = Boolean(preview && confirmText === IMPORT_CONFIRM_TEXT && !isLoading)

  const previewTotals = useMemo(() => {
    if (!preview) return { months: 0, rows: 0 }
    return {
      months: preview.months.length,
      rows: preview.months.reduce((sum, month) => sum + month.rowCount, 0),
    }
  }, [preview])

  async function refreshMonths() {
    setListLoading(true)
    setListError('')
    try {
      const res = await fetch('/api/admin/member-data', { method: 'GET' })
      const json = (await res.json()) as ListResponse
      if (!res.ok || !json.ok) throw new Error('Could not load the saved months.')
      setMonths(json.months || [])
    } catch {
      setListError('Could not load saved months. Please retry.')
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    refreshMonths()
  }, [])

  async function run(mode: 'preview' | 'import', source: 'upload' | 'server' = 'upload') {
    if (source === 'upload' && !file) {
      toast.error('Please choose an Excel workbook first.')
      return
    }

    if (isLoading || (mode === 'import' && !canImport)) return
    setError('')
    setIsLoading(true)
    setAction(mode)
    setLastSource(source)
    if (mode === 'preview') {
      setPreview(null)
      setImportResult(null)
      setConfirmText('')
    }

    try {
      const formData = new FormData()
      formData.append('mode', mode)
      formData.append('source', source)
      if (source === 'upload' && file) {
        formData.append('file', file)
      }

      const res = await fetch('/api/admin/member-data', {
        method: 'POST',
        body: formData,
      })

      const json = (await res.json()) as PreviewResponse | ImportResponse | ApiError
      if (!res.ok || !json.ok) {
        setError((json as ApiError).error || 'Upload failed')
        toast.error((json as ApiError).error || 'Upload failed')
        return
      }

      if (mode === 'preview') {
        const parsed = json as PreviewResponse
        setPreview(parsed)
        setSelectedMonth(parsed.months[0]?.period || '')
        toast.success(
          `Preview ready: ${parsed.months.length} month(s), ${parsed.months.reduce((sum, m) => sum + m.rowCount, 0).toLocaleString()} rows.`
        )
        return
      }

      const imported = json as ImportResponse
      setImportResult(imported)
      setPreview(null)
      setConfirmText('')
      toast.success(
        `Imported ${imported.importedMonths} month(s) and ${imported.importedRows.toLocaleString()} rows.`
      )
      await refreshMonths()
    } catch (err: any) {
      setError(err?.message || 'Unexpected error')
      toast.error(err?.message || 'Unexpected error')
    } finally {
      setIsLoading(false)
      setAction(null)
    }
  }

  function chooseFile(next: File | null) {
    if (isLoading) return
    if (next && !/\.xlsx?$/i.test(next.name)) {
      setError('Choose an Excel file (.xlsx or .xls).')
      return
    }
    setFile(next)
    setPreview(null)
    setImportResult(null)
    setConfirmText('')
    setError('')
  }
  const sample =
    preview?.months.find((month) => month.period === selectedMonth) || preview?.months[0]
  const step = importResult ? 3 : preview ? 2 : 1
  return (
    <div className="import-workflow">
      <ol className="import-steps" aria-label="Import progress">
        {['Choose workbook', 'Review data', 'Confirm import'].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? 'step' : undefined}
            data-complete={step > index + 1}
          >
            <span>
              {step > index + 1 ? <Check size={13} /> : String(index + 1).padStart(2, '0')}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {!preview && !importResult && (
        <div className="import-start-grid">
          <section className="admin-panel import-upload-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>Monthly workbook</h2>
                <p>Excel files with one sheet per month.</p>
              </div>
              <span className="admin-tag">.xlsx / .xls</span>
            </div>
            <label
              className={`import-dropzone ${dragging ? 'is-dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                if (!isLoading) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                if (!isLoading) chooseFile(event.dataTransfer.files[0] || null)
              }}
            >
              <input
                id="monthly-workbook"
                type="file"
                accept=".xlsx,.xls"
                disabled={isLoading}
                aria-label="Choose monthly workbook"
                onChange={(event) => chooseFile(event.target.files?.[0] || null)}
              />
              <span className="import-file-icon">
                <FileSpreadsheet size={27} strokeWidth={1.5} />
              </span>
              <strong>{file ? file.name : 'Drop your workbook here'}</strong>
              <span>
                {file
                  ? `${Math.max(1, Math.round(file.size / 1024))} KB · Ready to preview`
                  : 'or click to browse your files'}
              </span>
              <span className="import-browse">
                {file ? 'Choose a different file' : 'Browse files'}
                <Upload size={14} />
              </span>
            </label>
            <div className="import-upload-footer">
              <p>Previewing does not change any records.</p>
              <button
                type="button"
                disabled={!canUploadPreview}
                onClick={() => run('preview', 'upload')}
                className="btn-primary"
              >
                {isLoading && action === 'preview' ? 'Reading workbook…' : 'Preview workbook'}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <aside className="import-guide">
            <span className="admin-eyebrow">Before you import</span>
            <h2>A clear review before anything changes.</h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Check the months</strong>
                  <p>Each sheet is detected as a separate period.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Review the columns</strong>
                  <p>Inspect sample rows and any normalization notes.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Confirm the update</strong>
                  <p>Import replaces monthly snapshots and syncs member records.</p>
                </div>
              </li>
            </ol>
            <details className="import-server">
              <summary>Use a workbook already on the server</summary>
              <p>This previews the configured server file. It does not import immediately.</p>
              <button
                className="btn-ghost"
                type="button"
                disabled={!canServerPreview}
                onClick={() => run('preview', 'server')}
              >
                {isLoading && lastSource === 'server' ? 'Reading…' : 'Preview server workbook'}
              </button>
            </details>
          </aside>
        </div>
      )}
      {preview && (
        <section className="admin-panel import-preview">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-eyebrow">Ready for review</span>
              <h2>{lastSource === 'upload' ? file?.name : 'Server workbook'}</h2>
              <p>
                {previewTotals.months} months · {previewTotals.rows.toLocaleString()} rows detected
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              disabled={isLoading}
              onClick={() => {
                setPreview(null)
                setConfirmText('')
              }}
            >
              <RotateCcw size={14} />
              Change workbook
            </button>
          </div>
          {preview.validation && (
            <div className={`import-validation ${templateBadge(preview.validation).tone}`}>
              <strong>{templateBadge(preview.validation).label}</strong>
              {preview.validation.issues.length > 0 && (
                <p>{preview.validation.issues.join(' · ')}</p>
              )}
            </div>
          )}
          {preview.warnings.length > 0 && (
            <details className="import-notes">
              <summary>{preview.warnings.length} workbook notes</summary>
              <ul>
                {preview.warnings.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="import-months-review">
            <div className="import-month-list" role="group" aria-label="Preview month">
              {preview.months.map((month) => (
                <button
                  key={month.period}
                  type="button"
                  aria-pressed={sample?.period === month.period}
                  onClick={() => setSelectedMonth(month.period)}
                >
                  <div>
                    <strong>{month.label}</strong>
                    <span>{month.sheetName.trim()}</span>
                  </div>
                  <span>
                    {month.rowCount} rows
                    {month.warnings.length > 0 && <small>{month.warnings.length} notes</small>}
                  </span>
                </button>
              ))}
            </div>
            <div className="import-sample">
              <div className="admin-panel-heading">
                <div>
                  <h3>{sample?.label} sample rows</h3>
                  <p>Preview only. These values have not been saved.</p>
                </div>
              </div>
              {!!sample?.warnings.length && (
                <details className="import-notes">
                  <summary>{sample.warnings.length} notes for this month</summary>
                  <ul>
                    {sample.warnings.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="admin-table-scroll" tabIndex={0} aria-label="Preview data columns">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {preview.columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sample?.sampleRows.map((row, index) => (
                      <tr key={index}>
                        {preview.columns.map((column) => (
                          <td key={column}>{formatCell(row[column])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="import-confirm">
            <div>
              <h3>Confirm this import</h3>
              <p>
                This replaces the current monthly snapshots and syncs member records. Active members
                absent from the workbook may be suspended. Type <code>{IMPORT_CONFIRM_TEXT}</code>{' '}
                to continue.
              </p>
            </div>
            <div>
              <label className="sr-only" htmlFor="import-confirmation">
                Import confirmation
              </label>
              <input
                id="import-confirmation"
                value={confirmText}
                disabled={isLoading}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={IMPORT_CONFIRM_TEXT}
                autoComplete="off"
              />
              <button
                type="button"
                disabled={!canImport}
                onClick={() => run('import', lastSource)}
                className="btn-primary"
              >
                {isLoading && action === 'import' ? 'Importing…' : 'Confirm import'}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </section>
      )}
      {importResult && (
        <section className="admin-panel import-success" role="status">
          <span>
            <Check size={24} />
          </span>
          <h2>Workbook imported</h2>
          <p>
            {importResult.importedMonths} months and {importResult.importedRows.toLocaleString()}{' '}
            rows saved.
          </p>
          {importResult.syncedMembers !== undefined && (
            <p>
              {importResult.syncedMembers} member records synced
              {importResult.suspendedMembers !== undefined
                ? `; ${importResult.suspendedMembers} non-imported members suspended`
                : ''}
              .
            </p>
          )}
          {importResult.warnings.length > 0 && (
            <details className="import-notes">
              <summary>Import notes</summary>
              <ul>
                {importResult.warnings.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </details>
          )}
          <div>
            <Link href="/dashboard/member-data" className="btn-primary">
              View member data
              <ArrowUpRight size={15} />
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setImportResult(null)
                setFile(null)
              }}
            >
              Import another workbook
            </button>
          </div>
        </section>
      )}
      <section className="admin-panel">
        <header className="admin-panel-heading">
          <div>
            <h2>Saved months</h2>
            <p>Your current monthly snapshots.</p>
          </div>
          <span className="admin-tag">{months.length} periods</span>
        </header>
        {listError ? (
          <div className="admin-empty" role="alert">
            {listError}
            <button type="button" className="btn-ghost" onClick={refreshMonths}>
              Retry
            </button>
          </div>
        ) : listLoading ? (
          <p className="admin-empty" role="status">
            Loading saved months…
          </p>
        ) : !months.length ? (
          <p className="admin-empty">No months uploaded yet.</p>
        ) : (
          <div className="import-saved-months">
            {[...months].reverse().map((month) => (
              <Link
                key={month.period}
                href={`/dashboard/member-data?period=${encodeURIComponent(month.period)}`}
              >
                <span className="import-saved-icon">
                  <FileSpreadsheet size={18} />
                </span>
                <div>
                  <strong>{month.label}</strong>
                  <small>
                    {month.rowCount.toLocaleString()} members ·{' '}
                    {new Date(month.uploadedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </small>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
