'use client'

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { selectPosition } from './select-position'

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export type SelectOption = { value: string; label: string; description?: string; badge?: string }
type SmartSelectProps = {
  name?: string
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly (string | SelectOption)[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  searchable?: boolean
  className?: string
  invalid?: boolean
  'data-testid'?: string
}

export function SmartSelect({
  name,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled,
  required,
  searchable = true,
  className,
  invalid,
  'data-testid': testId,
}: SmartSelectProps) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [invalidValue, setInvalidValue] = useState(false)
  const [position, setPosition] = useState<ReturnType<typeof selectPosition>>({
    left: 0,
    top: 0,
    bottom: undefined,
    width: 0,
    maxHeight: 320,
  })
  const normalized = useMemo(
    () =>
      options.map((option) =>
        typeof option === 'string' ? { value: option, label: option } : option
      ),
    [options]
  )
  const selected = normalized.find((option) => option.value === value)
  const filtered = normalized.filter(
    (option) =>
      !searchable ||
      `${option.label} ${option.description || ''} ${option.value}`
        .toLowerCase()
        .includes(query.toLowerCase())
  )
  const visibleOptions =
    !query && value && !selected ? [{ value, label: value }, ...filtered] : filtered
  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }
  const choose = (nextValue: string) => {
    onChange(nextValue)
    setInvalidValue(false)
    close(true)
  }
  const show = () => {
    setQuery('')
    setActive(
      Math.max(
        0,
        normalized.findIndex((option) => option.value === value)
      )
    )
    // Keep a dropdown inside its dialog's top layer rather than the inert page behind it.
    setPortalTarget(trigger.current?.closest('dialog') || document.body)
    setOpen(true)
  }

  useClientLayoutEffect(() => {
    if (!open || !trigger.current) return
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect()
      setPosition(selectPosition(rect, { width: window.innerWidth, height: window.innerHeight }))
    }
    place()
    ;(searchable ? search.current : list.current)?.focus()
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close()
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', outside)
    }
  }, [open, searchable])
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector(`#${CSS.escape(id)}-option-${active}`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [active, open, id])
  function handleKey(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === 'Tab') close(true)
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((previous) =>
        Math.max(
          0,
          Math.min(visibleOptions.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1))
        )
      )
    } else if (
      (event.key === 'Enter' || (!searchable && event.key === ' ')) &&
      visibleOptions[active]
    ) {
      event.preventDefault()
      choose(visibleOptions[active].value)
    }
  }
  return (
    <div className={cn('relative min-w-0', className)}>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      {required && (
        <input
          aria-hidden="true"
          tabIndex={-1}
          value={value}
          onChange={() => {}}
          required
          disabled={disabled}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          onInvalid={(event) => {
            event.preventDefault()
            setInvalidValue(true)
            trigger.current?.focus()
          }}
        />
      )}
      <button
        ref={trigger}
        type="button"
        id={id}
        role="combobox"
        aria-label={label}
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid || invalidValue || undefined}
        aria-required={required || undefined}
        disabled={disabled}
        data-testid={testId}
        onClick={() => {
          if (open) close()
          else show()
        }}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault()
            if (open) handleKey(event)
            else show()
          }
        }}
        className={cn(
          'select-trigger group',
          open && 'is-open',
          (invalid || invalidValue) && '!border-rose-400'
        )}
      >
        <span
          className={cn('flex min-w-0 items-center gap-2.5', !value && 'text-muted-foreground')}
        >
          {selected?.badge && (
            <span className="flex h-6 min-w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 px-1.5 text-xs font-bold text-accent">
              {selected.badge}
            </span>
          )}
          <span className="truncate">{selected?.label || value || placeholder}</span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open &&
        portalTarget &&
        createPortal(
          <div ref={panel} className="select-popover" style={position} onKeyDown={handleKey}>
            {searchable && (
              <div className="flex items-center gap-2 border-b px-3.5 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={search}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActive(0)
                  }}
                  role="combobox"
                  aria-label={`Search ${label.toLowerCase()}`}
                  aria-controls={`${id}-list`}
                  aria-expanded={true}
                  aria-activedescendant={
                    visibleOptions[active] ? `${id}-option-${active}` : undefined
                  }
                  placeholder={`Search ${label.toLowerCase()}...`}
                  autoComplete="off"
                  className="min-w-0 w-full bg-transparent text-sm outline-none"
                />
              </div>
            )}
            <div
              ref={list}
              role="listbox"
              tabIndex={searchable ? undefined : -1}
              aria-activedescendant={
                !searchable && visibleOptions[active] ? `${id}-option-${active}` : undefined
              }
              id={`${id}-list`}
              aria-label={label}
              className="min-h-0 overflow-auto p-1.5"
            >
              {!visibleOptions.length && (
                <div className="flex flex-col items-center gap-2 px-3 py-7 text-xs text-muted-foreground">
                  <SearchX className="h-5 w-5" />
                  No matching options
                </div>
              )}
              {visibleOptions.map((option, index) => (
                <div
                  role="option"
                  id={`${id}-option-${index}`}
                  aria-selected={value === option.value}
                  key={option.value}
                  onPointerMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                  className={cn('select-option', index === active && 'is-highlighted')}
                >
                  {option.badge && (
                    <span className="flex h-8 min-w-9 shrink-0 items-center justify-center rounded-lg border bg-surface px-1 text-xs font-bold text-accent">
                      {option.badge}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-5">{option.label}</p>
                    {option.description && (
                      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                        {option.description}
                      </p>
                    )}
                  </div>
                  {value === option.value && <Check className="h-4 w-4 shrink-0 text-accent" />}
                </div>
              ))}
            </div>
            <div className="border-t bg-surface-2/50 px-3.5 py-2 text-xs text-muted-foreground">
              {visibleOptions.length} option{visibleOptions.length !== 1 ? 's' : ''}{' '}
              <span className="float-right">↑↓ Navigate · Enter to select</span>
            </div>
          </div>,
          portalTarget
        )}
      {(invalid || invalidValue) && (
        <p className="mt-1.5 text-xs text-rose-600">Choose {label.toLowerCase()}.</p>
      )}
    </div>
  )
}

export function FormSelect({
  children,
  name,
  defaultValue,
  disabled,
  required,
  className,
  'aria-label': label,
}: {
  children: ReactNode
  name: string
  defaultValue?: string | number
  disabled?: boolean
  required?: boolean
  className?: string
  'aria-label'?: string
}) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as { value?: string | number; children?: ReactNode }
      return {
        value: String(props.value ?? props.children ?? ''),
        label: String(props.children ?? ''),
      }
    })
  const initialValue = String(defaultValue ?? options[0]?.value ?? '')
  const [value, setValue] = useState(initialValue)
  useEffect(() => setValue(initialValue), [initialValue])
  return (
    <SmartSelect
      name={name}
      label={label || name.replace(/([a-z])([A-Z])/g, '$1 $2')}
      value={value}
      onChange={setValue}
      options={options}
      required={required}
      disabled={disabled}
      className={className}
      searchable={options.length > 5}
    />
  )
}
