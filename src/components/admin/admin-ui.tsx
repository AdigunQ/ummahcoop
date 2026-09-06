import type { ReactNode } from 'react'

export function AdminHeading({
  title,
  description,
  section,
  actions,
}: {
  title: string
  description?: ReactNode
  section?: string
  actions?: ReactNode
}) {
  return (
    <header className="admin-heading">
      <div>
        {section && <p className="admin-eyebrow">{section}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-heading-actions">{actions}</div>}
    </header>
  )
}

export function AdminStats({
  items,
}: {
  items: { label: string; value: string; note?: string }[]
}) {
  return (
    <section className="admin-stats" aria-label="Summary">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </section>
  )
}

export function AdminPanel({
  title,
  note,
  actions,
  children,
  className = '',
}: {
  title?: string
  note?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`admin-panel ${className}`}>
      {title && (
        <header className="admin-panel-heading">
          <div>
            <h2>{title}</h2>
            {note && <p>{note}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
