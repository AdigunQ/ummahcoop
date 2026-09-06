'use client'

import { useState, type ReactNode } from 'react'
import { ArrowDownToLine, ShieldAlert } from 'lucide-react'

export function ImportWorkspace({
  workbook,
  replace,
}: {
  workbook: ReactNode
  replace: ReactNode
}) {
  const [advanced, setAdvanced] = useState(false)
  return (
    <>
      <div className="admin-view-tabs" role="group" aria-label="Import method">
        <button type="button" aria-pressed={!advanced} onClick={() => setAdvanced(false)}>
          <ArrowDownToLine size={15} />
          Monthly workbook
        </button>
        <button type="button" aria-pressed={advanced} onClick={() => setAdvanced(true)}>
          <ShieldAlert size={15} />
          Replace directory
        </button>
      </div>
      <div hidden={advanced}>{workbook}</div>
      <div hidden={!advanced} className="admin-panel admin-replace-panel">
        <div className="admin-caution">
          <ShieldAlert size={20} />
          <div>
            <h2>Replace the entire member directory</h2>
            <p>
              This deletes existing members and replaces them with the uploaded file. Use the
              monthly workbook tab for routine updates.
            </p>
          </div>
        </div>
        {replace}
      </div>
    </>
  )
}
