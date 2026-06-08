'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  className?: string
  variant?: 'icon' | 'switch'
  'data-testid'?: string
}

export function ThemeToggle({ className = '', variant = 'icon', 'data-testid': testId }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  const toggle = () => setTheme(isDark ? 'light' : 'dark')

  if (variant === 'switch') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        suppressHydrationWarning
        data-testid={testId}
        className={`group relative inline-flex h-9 w-16 items-center rounded-full border bg-surface-2 px-1 transition-colors hover:border-ring/40 ${className}`}
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <span
          className={`flex h-7 w-7 transform items-center justify-center rounded-full bg-surface shadow-sm transition-transform duration-300 ${
            isDark ? 'translate-x-7' : 'translate-x-0'
          }`}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
        >
          {isDark ? (
            <Moon className="h-3.5 w-3.5 text-foreground" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-foreground" />
          )}
        </span>
        <span className="sr-only">Toggle theme</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      suppressHydrationWarning
      data-testid={testId}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-surface text-foreground transition-all hover:border-ring/40 hover:bg-surface-2 ${className}`}
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      {mounted ? (
        isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  )
}
