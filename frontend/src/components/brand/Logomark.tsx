import { cn } from '@/lib/cn'

/** The sea surface: a swell running edge to edge, crest at the centre. */
const WATERLINE = 'M0 15.75c2 0 2-2 4-2s2 2 4 2s2-2 4-2s2 2 4 2s2-2 4-2s2 2 4 2'

/**
 * A.W.A.R.E.: a Tar Black square with a Signal Yellow waterline and one square riding its crest,
 * the shape of one detection on the chart. Waste found on the sea surface. Square corners, no glow.
 * Decorative by default; pass a title when it stands alone.
 */
export function Logomark({
  className,
  title,
  size = 24,
}: {
  className?: string
  title?: string
  /** Pixels. 24 in the top bar. */
  size?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="24" height="24" className="fill-tar" />
      <rect x="9.5" y="7" width="5" height="6" className="fill-signal" />
      {/* A Tar band under the swell cuts the square's foot, so it floats in the water. */}
      <path d={WATERLINE} fill="none" className="stroke-tar" strokeWidth="3.5" />
      <path d={WATERLINE} fill="none" className="stroke-signal" strokeWidth="1.5" />
    </svg>
  )
}
