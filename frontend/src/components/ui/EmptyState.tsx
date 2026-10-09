import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  title: ReactNode
  /** Why there is nothing here, in plain words. */
  description?: ReactNode
  /** One action: a button or link. */
  action?: ReactNode
  /** Compact version for panels and ledger bodies. */
  size?: 'sm' | 'md'
  className?: string
  headingLevel?: 1 | 2 | 3
}

/** Typographic: a title, a sentence and one action. No illustration, no box. */
export function EmptyState({
  title,
  description,
  action,
  size = 'md',
  className,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <div
      className={cn(
        'flex max-w-prose flex-col items-start',
        size === 'md' ? 'gap-2 py-12' : 'gap-1 py-6',
        className,
      )}
    >
      <Heading className={cn(size === 'md' ? 'text-title' : 'text-lead font-medium', 'text-ink')}>
        {title}
      </Heading>
      {description ? (
        <p className={cn(size === 'md' ? 'text-lead' : 'text-body', 'text-ink-2')}>{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
