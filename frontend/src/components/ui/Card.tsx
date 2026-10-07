import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const

export interface CardProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  /** Controls at the right of the header. */
  actions?: ReactNode
  padding?: keyof typeof PADDING
  /** Heading level for the title. */
  headingLevel?: 2 | 3 | 4
}

/** Plain white surface with a 1px border. Use sparingly: not everything needs a card. */
export function Card({
  title,
  description,
  actions,
  padding = 'md',
  headingLevel = 3,
  className,
  children,
  ...rest
}: CardProps) {
  const Heading = `h${headingLevel}` as const
  const hasHeader = Boolean(title || description || actions)
  return (
    <section
      className={cn(
        'rounded-card border border-border bg-surface shadow-subtle',
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {hasHeader ? (
        <header className={cn('flex items-start gap-3', children ? 'mb-4' : '')}>
          <div className="min-w-0 flex-1">
            {title ? <Heading className="text-heading text-ink">{title}</Heading> : null}
            {description ? <p className="mt-0.5 text-small text-ink-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}
