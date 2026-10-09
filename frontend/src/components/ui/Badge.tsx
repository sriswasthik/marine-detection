import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: 'border-border bg-surface text-ink-muted', dot: 'bg-ink-muted' },
  accent: { badge: 'border-transparent bg-accent-soft text-accent', dot: 'bg-accent' },
  success: { badge: 'border-transparent bg-success-soft text-success', dot: 'bg-success' },
  warning: { badge: 'border-transparent bg-warning-soft text-warning', dot: 'bg-warning' },
  danger: { badge: 'border-transparent bg-danger-soft text-danger', dot: 'bg-danger' },
}

export const BADGE_BASE =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-badge border px-2 text-caption font-medium whitespace-nowrap [&_svg]:size-3.5'

export interface BadgeProps extends ComponentPropsWithRef<'span'> {
  tone?: BadgeTone
  icon?: ReactNode
  /** Small status dot before the label. */
  dot?: boolean
}

export function Badge({ tone = 'neutral', icon, dot, className, children, ...rest }: BadgeProps) {
  const styles = TONES[tone]
  return (
    <span className={cn(BADGE_BASE, styles.badge, className)} {...rest}>
      {dot ? <span aria-hidden className={cn('size-1.5 rounded-full', styles.dot)} /> : null}
      {icon}
      {children}
    </span>
  )
}
