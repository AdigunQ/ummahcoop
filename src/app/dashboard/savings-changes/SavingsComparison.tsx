import { formatCurrency } from '@/lib/utils'

type SavingsComparisonProps = {
  previousThrift: number
  previousSpecial: number
  requestedThrift: number
  requestedSpecial: number
}

export function SavingsComparison({ previousThrift, previousSpecial, requestedThrift, requestedSpecial }: SavingsComparisonProps) {
  const amounts = [
    { label: 'Thrift savings', old: previousThrift, requested: requestedThrift },
    { label: 'Special savings', old: previousSpecial, requested: requestedSpecial },
    { label: 'Total monthly savings', old: previousThrift + previousSpecial, requested: requestedThrift + requestedSpecial },
  ]

  return (
    <section aria-label="Old and requested monthly savings" className="mb-6 space-y-4">
      {amounts.map(amount => (
        <div key={amount.label} className="rounded-xl border border-border p-4">
          <h3 className="mb-3 font-semibold">{amount.label}</h3>
          <dl className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">Old monthly amount</dt>
              <dd className="mt-1 break-words font-semibold tabular-nums">{formatCurrency(amount.old)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">Requested monthly amount</dt>
              <dd className="mt-1 break-words font-semibold tabular-nums">{formatCurrency(amount.requested)}</dd>
            </div>
          </dl>
        </div>
      ))}
      <p className="text-sm leading-6 text-muted-foreground">Old amounts are the monthly deductions when the request was submitted, not the member&apos;s saved balance.</p>
    </section>
  )
}
