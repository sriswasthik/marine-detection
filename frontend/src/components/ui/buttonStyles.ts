import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger-quiet'
export type ButtonSize = 'sm' | 'md'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none ' +
  'transition-colors duration-150 ease-out disabled:cursor-not-allowed ' +
  '[&_svg]:size-4 [&_svg]:shrink-0'

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-small',
  md: 'h-9 px-3.5 text-body',
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover',
  secondary:
    'border border-border-strong bg-surface text-ink shadow-subtle hover:bg-bg active:bg-border/60',
  ghost: 'text-ink hover:bg-ink/5 active:bg-ink/8',
  'danger-quiet':
    'border border-border bg-surface text-danger hover:border-danger/30 hover:bg-danger-soft',
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
  return cn(BASE, SIZES[size], VARIANTS[variant], !loading && 'disabled:opacity-50', className)
}

export const ICON_BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-8 px-0',
  md: 'size-9 px-0',
}
