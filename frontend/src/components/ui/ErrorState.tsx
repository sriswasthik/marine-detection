import { CircleAlert, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export interface ErrorStateProps {
  title?: ReactNode
  /** What went wrong and what to do next. */
  description: ReactNode
  onRetry?: () => void
  retryLabel?: string
  /** Extra actions, for example a link back to the overview. */
  action?: ReactNode
  /** Technical reference such as an error code, shown small for support. */
  details?: string
  size?: 'sm' | 'md'
  className?: string
  headingLevel?: 1 | 2 | 3
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  action,
  details,
  size = 'md',
  className,
  headingLevel = 2,
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <div
      role="alert"
      className={cn(
        'mx-auto flex max-w-md flex-col items-center text-center',
        size === 'md' ? 'gap-3 py-12' : 'gap-2 py-6',
        className,
      )}
    >
      <span
        aria-hidden
        className="mb-1 inline-flex size-10 items-center justify-center rounded-control bg-danger-soft text-danger"
      >
        <CircleAlert className="size-5" />
      </span>
      <Heading className="text-heading text-ink">{title}</Heading>
      <p className="text-body text-ink-muted">{description}</p>
      {onRetry || action ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button variant="secondary" iconStart={<RotateCcw aria-hidden />} onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
      {details ? <p className="mono-label mt-1 text-ink-muted">{details}</p> : null}
    </div>
  )
}
