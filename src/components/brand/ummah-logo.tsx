import { cn } from '@/lib/utils'

type UmmahLogoProps = {
  className?: string
  markClassName?: string
  textClassName?: string
  showText?: boolean
  compactText?: boolean
}

export function UmmahLogo({
  className,
  markClassName,
  textClassName,
  showText = true,
  compactText = false,
}: UmmahLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        className={cn('h-10 w-10 shrink-0 text-accent', markClassName)}
        viewBox="0 0 48 48"
        role="img"
        aria-label="Ummah Coop logo"
      >
        <rect width="48" height="48" rx="14" fill="currentColor" />
        <path
          d="M14 13v13a10 10 0 0 0 20 0V13"
          fill="none"
          stroke="#e0edbd"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M23 13v13a1 1 0 0 0 2 0V13"
          fill="none"
          stroke="#e0edbd"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <div className={cn('leading-tight', textClassName)}>
          <p className="text-[1.1875rem] font-semibold tracking-normal">
            ummah<span className="font-normal opacity-60">coop</span>
            <span className="text-accent">.</span>
          </p>
          {!compactText && (
            <p className="mt-1 text-xs tracking-normal opacity-60">Growing together.</p>
          )}
        </div>
      )}
    </div>
  )
}
