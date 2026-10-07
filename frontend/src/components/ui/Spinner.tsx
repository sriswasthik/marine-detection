import { cn } from '@/lib/cn'

const SIZES = {
  sm: 'size-3.5 border-[1.5px]',
  md: 'size-4 border-[1.5px]',
  lg: 'size-6 border-2',
} as const

interface SpinnerProps {
  size?: keyof typeof SIZES
  /** Announced to screen readers. Pass null when the surrounding control already says it is busy. */
  label?: string | null
  className?: string
}

/** Calm thin ring. Inherits the text colour. */
export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0', className)}
    >
      <span
        className={cn(
          'block animate-spin rounded-full border-current/20 border-t-current [animation-duration:900ms]',
          SIZES[size],
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
