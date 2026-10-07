import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Compact version for panels and table bodies. */
  size?: 'sm' | 'md'
  className?: string
  headingLevel?: 1 | 2 | 3
}

/** Explains why there is nothing here and what to do next. */
export function EmptyState({
  icon,
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
        'mx-auto flex max-w-sm flex-col items-center text-center',
        size === 'md' ? 'gap-3 py-12' : 'gap-2 py-6',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="mb-1 inline-flex size-10 items-center justify-center rounded-control border border-border bg-surface text-ink-muted [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <Heading className="text-heading text-ink">{title}</Heading>
      {description ? <p className="text-body text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}
