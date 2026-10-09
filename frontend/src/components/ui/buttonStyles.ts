import { cn } from '@/lib/cn'

/**
 * - primary: the only solid ink block on the page, white label, lifts 2px on hover. Exactly one
 *   per view (the top bar carries it unless the view has its own). After McHaXYT's two-tone
 *   button on uiverse.io (MIT); put a muted qualifier in a `.text-white/60` span.
 * - secondary: a 1px ink outline whose ink fill wipes in from the left on hover. After
 *   Cornerstone-04's outline button on uiverse.io (MIT).
 * - tertiary: an Ultramarine text link with a trailing arrow (Button adds the arrow).
 * - ghost: no outline, for icon buttons inside toolbars.
 * - danger-quiet: outline with danger text, for destructive actions that are not the main one.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger-quiet'
export type ButtonSize = 'sm' | 'md'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none ' +
  'transition-[color,background-color,border-color,box-shadow,transform] duration-[160ms] ease-out ' +
  'disabled:cursor-not-allowed ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

/** Phones get 40px tap targets (max-sm:h-10); desktop keeps the compact sizes. */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 text-small max-sm:h-10',
  md: 'h-9 text-body max-sm:h-10',
}

/** Horizontal padding; tertiary links have none, so their text aligns with the column. */
const PADDING: Record<ButtonSize, string> = { sm: 'px-3', md: 'px-4' }

const VARIANTS: Record<ButtonVariant, string> = {
  // Ink with white text (over 17:1).
  primary:
    'bg-accent text-on-accent hover:-translate-y-0.5 hover:bg-accent-hover active:translate-y-0 disabled:hover:translate-y-0',
  secondary:
    'relative isolate overflow-hidden border border-ink text-ink ' +
    'before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-ink ' +
    'before:transition-transform before:duration-[200ms] before:ease-out ' +
    'hover:text-white hover:before:scale-x-100 focus-visible:text-white focus-visible:before:scale-x-100 ' +
    'disabled:hover:text-ink disabled:hover:before:scale-x-0',
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
