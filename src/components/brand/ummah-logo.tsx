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
        <defs>
          <linearGradient id="ummahLogoBg" x1="12" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60a5fa" />
            <stop offset="0.54" stopColor="#2563eb" />
            <stop offset="1" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="ummahLogoStroke" x1="22" y1="14" x2="42" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#dbeafe" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#ummahLogoBg)" />
        <rect x="1.5" y="1.5" width="61" height="61" rx="14.5" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
        <path
          d="M20.5 17.5v19.8C20.5 48 26.2 54 32 54s11.5-6 11.5-16.7V17.5"
          fill="none"
          stroke="url(#ummahLogoStroke)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M27 18v18.6c0 5.5 2.1 8.2 5 8.2s5-2.7 5-8.2V18"
          fill="none"
          stroke="#bfdbfe"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx="44" cy="18" r="4.5" fill="#eff6ff" opacity="0.96" />
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
