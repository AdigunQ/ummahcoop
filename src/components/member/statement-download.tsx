'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Download, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function StatementDownload({
  className = 'btn-secondary',
  children = 'Statement',
}: {
  className?: string
  children?: ReactNode
}) {
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)

  async function download() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    try {
      const response = await fetch('/api/member-statement/export', {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) {
        throw new Error('Statement unavailable')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download =
        response.headers.get('content-disposition')?.match(/filename="([\w.-]+)"/)?.[1] ||
        'ummah-statement.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch {
      toast.error(
        'Your statement could not be downloaded. Please try again. If you have signed out, sign in first.'
      )
    } finally {
      clearTimeout(timeout)
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={download}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      ) : (
        <Download size={18} aria-hidden="true" />
      )}
      <span>{pending ? 'Preparing statement...' : children}</span>
    </button>
  )
}
