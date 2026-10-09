import { cn } from '@/lib/cn'

/**
 * Underlined input styles: no box and no fill, a hairline underline that darkens on hover and
 * turns danger when invalid. Focus draws the standard 2px accent outline.
 */
export function inputStyles({
  invalid = false,
  size = 'md',
  numeric = false,
  className,
}: {
  invalid?: boolean
  size?: 'sm' | 'md'
  /** Mono, tabular figures, for coordinates. */
  numeric?: boolean
  className?: string
} = {}): string {
  return cn(
    'w-full rounded-none border-0 border-b bg-transparent px-0 text-ink placeholder:text-ink-2',
    'transition-colors duration-[120ms] ease-out hover:border-ink',
    'disabled:cursor-not-allowed disabled:text-ink-2 disabled:hover:border-rule',
    size === 'sm' ? 'h-8' : 'h-9',
    numeric ? 'num font-mono text-mono' : size === 'sm' ? 'text-small' : 'text-body',
    'max-sm:h-10',
    invalid ? 'border-danger' : 'border-rule',
    className,
  )
}
