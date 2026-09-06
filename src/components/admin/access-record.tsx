'use client'

import { ShieldCheck, ChevronDown } from 'lucide-react'
import { FormSelect } from '@/components/ui/smart-select'
import { AdminSubmit } from './admin-collection'

export function AccessRecord({
  name,
  staffId,
  currentLabel,
  currentBundle,
  codes,
  options,
  action,
  memberId,
}: {
  name: string
  staffId: string | null
  currentLabel: string
  currentBundle: string
  codes: string[]
  options: { value: string; label: string; description: string }[]
  action: (data: FormData) => Promise<void>
  memberId: string
  searchText?: string
}) {
  return (
    <details className="admin-access-record">
      <summary>
        <span className="admin-avatar">
          <ShieldCheck size={17} />
        </span>
        <div>
          <strong>{name}</strong>
          <small>Staff ID {staffId || 'Not set'}</small>
        </div>
        <span className="admin-tag">{currentLabel}</span>
        <ChevronDown size={16} />
      </summary>
      <div className="admin-access-editor">
        <section>
          <h3>Current permissions</h3>
          {codes.length ? (
            <div className="admin-permissions">
              {codes.map((code) => (
                <span key={code}>{code}</span>
              ))}
            </div>
          ) : (
            <p>Member access only. No administration permissions.</p>
          )}
        </section>
        <form action={action}>
          <input type="hidden" name="memberId" value={memberId} />
          <label className="admin-field-label">Access role</label>
          <FormSelect
            name="bundle"
            aria-label={`Access role for ${name}`}
            defaultValue={currentBundle}
            key={currentBundle}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FormSelect>
          <p>
            Changing this role replaces the member&apos;s current permission set. Their member account
            remains available.
          </p>
          <AdminSubmit pendingLabel="Updating access…">Update access</AdminSubmit>
        </form>
      </div>
    </details>
  )
}
