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
    <div className={cn('flex items-center gap-3', className)}>
      <svg
        className={cn('h-12 w-12 shrink-0', markClassName)}
        viewBox="0 0 64 64"
        role="img"
        aria-label="Ummah Coop logo"
      >
        <rect width="64" height="64" rx="18" fill="#07130d" />
        <path
          d="M20 18v20.4C20 48 26.2 54 32 54s12-6 12-15.6V18"
          fill="none"
          stroke="#8bd49d"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M25 18v19.2c0 5.9 3.1 9.1 7 9.1s7-3.2 7-9.1V18"
          fill="none"
          stroke="#f4c96b"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.95"
        />
        <circle cx="45.5" cy="17.5" r="5.5" fill="#f4c96b" />
        <path
          d="M18 43c5.8 4.5 12.7 6.2 21 4.2"
          fill="none"
          stroke="#f7f3ea"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>

      {showText ? (
        <div className={cn('leading-tight', textClassName)}>
          <p className="font-bold tracking-tight">Ummah Coop</p>
          {!compactText ? (
            <p className="text-xs font-medium opacity-70">Savings and loans cooperative</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
