import { cn } from '@/lib/cn'

/**
 * - primary: Tar Black fill, white label. Exactly one per view (the top bar carries it unless
 *   the view has its own).
 * - secondary: 1px ink outline, no fill.
 * - tertiary: an Olive Ink text link with a trailing arrow (Button adds the arrow).
 * - ghost: no outline, for icon buttons inside toolbars.
 * - danger-quiet: outline with danger text, for destructive actions that are not the main one.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger-quiet'
export type ButtonSize = 'sm' | 'md'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none ' +
  'transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

/** Phones get 40px tap targets (max-sm:h-10); desktop keeps the compact sizes. */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 text-small max-sm:h-10',
  md: 'h-9 text-body max-sm:h-10',
}

/** Horizontal padding; tertiary links have none, so their text aligns with the column. */
const PADDING: Record<ButtonSize, string> = { sm: 'px-3', md: 'px-4' }

const VARIANTS: Record<ButtonVariant, string> = {
  // Tar Black with white text (17.9:1). Yellow stays in the logomark: it clashes with Low.
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover',
  secondary: 'border border-ink text-ink hover:bg-hairline/60 active:bg-hairline',
  tertiary:
    'text-accent-ink underline-offset-4 hover:text-tar hover:underline [&_svg]:transition-transform hover:[&_svg]:translate-x-1',
  ghost: 'text-ink hover:bg-ink/5 active:bg-ink/10',
  'danger-quiet': 'border border-hairline text-danger hover:border-danger hover:bg-danger-soft',
}

/** Button classes, also used to style links that look like buttons. */
export function buttonStyles({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  className?: string
} = {}): string {
  return cn(
    BASE,
    SIZES[size],
    variant !== 'tertiary' && PADDING[size],
    VARIANTS[variant],
    !loading && 'disabled:opacity-50',
    className,
  )
}

export const ICON_BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-8 max-sm:size-10',
  md: 'size-9 max-sm:size-10',
}
