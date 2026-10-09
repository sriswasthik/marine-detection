import { cn } from '@/lib/cn'

const SIZES = {
  sm: 'size-3',
  md: 'size-4',
  lg: 'size-6',
} as const

interface SpinnerProps {
  size?: keyof typeof SIZES
  /** Announced to screen readers. Pass null when the surrounding control already says it is busy. */
  label?: string | null
  className?: string
}

/** A small square outline turning slowly. Inherits the text colour. No circles, no glow. */
export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0 items-center justify-center', SIZES[size], className)}
    >
      <span className="block size-[70%] animate-spin border border-current border-t-transparent [animation-duration:1200ms]" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
