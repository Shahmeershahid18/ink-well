import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

/**
 * An ink droplet whose lower half is filled to a level line — the drop says ink,
 * the level says stock. It stays legible down to 16px because the only interior
 * detail is a single straight edge.
 */
export function LogoMark({
  className,
  size = 28,
  /** Unique per instance: two gradients with the same id on one page collide. */
  idPrefix = 'inkwell',
}: {
  className?: string
  size?: number
  idPrefix?: string
}) {
  const gradientId = `${idPrefix}-grad`
  const clipId = `${idPrefix}-clip`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor={BRAND.gradientFrom} />
          <stop offset="1" stopColor={BRAND.gradientTo} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M16 2.6c0 0 9.4 10.1 9.4 15.1a9.4 9.4 0 1 1-18.8 0C6.6 12.7 16 2.6 16 2.6Z" />
        </clipPath>
      </defs>

      {/* the drop */}
      <path
        d="M16 2.6c0 0 9.4 10.1 9.4 15.1a9.4 9.4 0 1 1-18.8 0C6.6 12.7 16 2.6 16 2.6Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* filled to the level line */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="19" width="32" height="13" fill={`url(#${gradientId})`} />
      </g>
    </svg>
  )
}

export function Wordmark({
  className,
  size = 28,
  showTagline = false,
  idPrefix,
}: {
  className?: string
  size?: number
  showTagline?: boolean
  idPrefix?: string
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark size={size} idPrefix={idPrefix} />
      <span className="flex flex-col leading-none">
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: size * 0.62 }}
        >
          {BRAND.name}
        </span>
        {showTagline && (
          <span className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{BRAND.tagline}</span>
        )}
      </span>
    </span>
  )
}
