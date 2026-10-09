import { cn } from '@/lib/cn'

/** The sea surface: a swell running across the mark. */
const WATERLINE =
  'M3 17c1.5 0 1.5-1.5 3-1.5s1.5 1.5 3 1.5s1.5-1.5 3-1.5s1.5 1.5 3 1.5s1.5-1.5 3-1.5s1.5 1.5 3 1.5'

/**
 * A.W.A.R.E.: a flat ink square, two survey arcs over the swell and one detection at their centre.
 * Waste found on the sea surface. One colour, no gradient. Decorative by default; pass a title
 * when it stands alone.
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
      <path
        d="M4.5 12.5a7.5 7.5 0 0 1 15 0"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="1.2"
      />
      <path
        d="M8.25 12.5a3.75 3.75 0 0 1 7.5 0"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
      <rect x="10.75" y="10.25" width="2.5" height="2.5" fill="#fff" />
      <path d={WATERLINE} fill="none" stroke="#fff" strokeWidth="1.4" />
    </svg>
  )
}
