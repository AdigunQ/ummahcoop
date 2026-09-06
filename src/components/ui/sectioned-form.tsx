'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'

export function SectionedForm({
  action,
  sections,
  hiddenFields,
  note,
}: {
  action: (data: FormData) => void | Promise<void>
  sections: { id: string; label: string; description: string; content: ReactNode }[]
  hiddenFields?: ReactNode
  note?: string
}) {
  const [active, setActive] = useState(sections[0].id)
  const invalidTarget = useRef<HTMLElement | null>(null)
  const [validationError, setValidationError] = useState('')
  return (
    <form
      action={action}
      className="settings-panel"
      onInputCapture={() => setValidationError('')}
      onSubmit={() => setValidationError('')}
      onInvalidCapture={(event) => {
        event.preventDefault()
        if (invalidTarget.current) return
        const target = event.target as HTMLElement
        setValidationError((target as HTMLInputElement).validationMessage || 'Check this field before saving.')
        invalidTarget.current = target
        const section = target.closest<HTMLElement>('[data-form-section]')
        if (section?.dataset.formSection) setActive(section.dataset.formSection)
        requestAnimationFrame(() => {
          const control = target.getAttribute('aria-hidden') === 'true'
            ? target.parentElement?.querySelector<HTMLElement>('[role="combobox"]')
            : target
          control?.focus()
          control?.scrollIntoView({ block: 'nearest' })
          invalidTarget.current = null
        })
      }}
    >
      {hiddenFields}
      {validationError && <p role="alert" className="mx-5 mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 sm:mx-8">{validationError}</p>}
      <nav aria-label="Record sections" className="settings-tabs !mx-5 !mb-0 !mt-5 sm:!mx-8">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActive(section.id)}
            className={active === section.id ? 'active' : ''}
            aria-current={active === section.id ? 'page' : undefined}
          >
            {section.label}
          </button>
        ))}
      </nav>
      {sections.map((section) => (
        <section
          key={section.id}
          data-form-section={section.id}
          hidden={active !== section.id}
          className="p-5 sm:p-8"
        >
          <h2 className="text-lg font-semibold tracking-normal">{section.label}</h2>
          <p className="mb-7 mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">
            {section.description}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">{section.content}</div>
        </section>
      ))}
      <SaveBar note={note} />
    </form>
  )
}
function SaveBar({ note }: { note?: string }) {
  const { pending } = useFormStatus()
  return (
    <footer className="settings-savebar">
      <p className="flex-1 text-xs leading-5 text-muted-foreground">
        {note || 'Changes are only applied when you save.'}
      </p>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {pending ? 'Saving...' : 'Save changes'}
      </button>
    </footer>
  )
}
