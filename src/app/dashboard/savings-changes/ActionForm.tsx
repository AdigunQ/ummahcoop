'use client'

import { useState, useTransition, type ReactNode, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { parseSavingsChangePlan } from '@/lib/savings-change-policy'

export function SavingsActionForm({ action, children, label, review = false }: {
  action: (data: FormData) => Promise<{ error?: string; success?: string }>
  children?: ReactNode
  label: string
  review?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; success?: string }>({})
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    if (review) data.set('decision', button?.value || '')
    setResult({})
    if (data.has('thrift') || data.has('special')) {
      try {
        parseSavingsChangePlan(data.get('thrift'), data.get('special'))
      } catch (error) {
        setResult({ error: error instanceof Error ? error.message : 'Check your savings amounts.' })
        return
      }
    }
    startTransition(async () => {
      try {
        const response = await action(data)
        setResult(response)
        if (response.success) router.refresh()
      } catch {
        setResult({ error: 'Could not reach the server. Refresh to check the request before trying again.' })
      }
    })
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        {children}
        <div className="flex flex-wrap gap-3">
          <button type="submit" name={review ? 'decision' : undefined} value={review ? 'approve' : undefined} className="btn-primary">
            {pending ? 'Saving...' : label}
          </button>
          {review && <button type="submit" name="decision" value="reject" formNoValidate className="btn-secondary">Decline request</button>}
        </div>
      </fieldset>
      {result.error && <p role="alert" className="rounded-lg border border-rose-200 p-4 text-rose-700">{result.error}</p>}
      {result.success && <p role="status" className="rounded-lg border border-emerald-200 p-4 text-emerald-800">{result.success}</p>}
    </form>
  )
}
