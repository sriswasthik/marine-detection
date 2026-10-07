import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  /** Optional text in the middle of a horizontal divider. */
  label?: ReactNode
  className?: string
}

export function Divider({ orientation = 'horizontal', label, className }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn('w-px self-stretch bg-border', className)}
      />
    )
  }
  if (label) {
    return (
      <div role="separator" className={cn('flex items-center gap-3', className)}>
        <span className="h-px flex-1 bg-border" />
        <span className="text-caption font-medium text-ink-muted">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    )
  }
  return <hr className={cn('h-px border-0 bg-border', className)} />
}
