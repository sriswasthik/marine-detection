import { cn } from '@/lib/cn'

/**
 * Teal rounded square with a wave line and a single dot: water, and one detection on it.
 * Decorative by default; pass a title when it stands alone.
 */
export function Logomark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={cn('size-7 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="28" height="28" rx="7" className="fill-accent" />
      <path
        d="M6 17.5c2 0 2-2.5 4-2.5s2 2.5 4 2.5 2-2.5 4-2.5"
        fill="none"
        className="stroke-white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20.75" cy="9.5" r="1.75" className="fill-white" />
    </svg>
  )
}
