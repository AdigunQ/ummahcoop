'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { SmartSelect } from '@/components/ui/smart-select'

export function PeriodPicker({
  options,
  value,
  basePath = '/dashboard/member-data',
}: {
  options: { period: string; label: string; isUploaded?: boolean }[]
  value: string
  basePath?: string
}) {
  const router = useRouter()
  const index = options.findIndex((option) => option.period === value)
  const change = (period: string) => router.push(`${basePath}?period=${encodeURIComponent(period)}`)
  return (
    <div className="admin-period-picker">
      <CalendarDays size={16} />
      <SmartSelect
        className="admin-period-select"
        label="Ledger month"
        value={value}
        onChange={change}
        options={options.map((option) => ({ value: option.period, label: option.label }))}
      />
      <div className="admin-period-arrows">
        <button
          type="button"
          aria-label="Previous month"
          disabled={index <= 0}
          onClick={() => change(options[index - 1].period)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label="Next month"
          disabled={index < 0 || index >= options.length - 1}
          onClick={() => change(options[index + 1].period)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
