import { CircleAlert, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { AppError } from '@/lib/errors/appError'
import { ERROR_COPY } from '@/lib/errors/errorCopy'
import { Button } from './Button'

export interface ErrorStateProps {
  /**
   * The normalised error (see toAppError). Supplies the title, message, retry and reference;
   * any of the props below override it.
   */
  error?: AppError
  title?: ReactNode
  /** What went wrong and what to do next. */
  description?: ReactNode
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

/** Explains a failure and offers the next step. Never shows raw messages or stack traces. */
export function ErrorState({
  error,
  title,
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
  const fallback = ERROR_COPY.UNEXPECTED
  const shownTitle = title ?? error?.title ?? fallback.title
  const shownDescription = description ?? error?.message ?? fallback.message
  const retry = onRetry ?? error?.retry
  const reference =
    details ??
    (error ? `${error.code}${error.reference ? ` · ${error.reference}` : ''}` : undefined)
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
      <Heading className="text-heading text-ink">{shownTitle}</Heading>
      <p className="text-body text-ink-muted">{shownDescription}</p>
      {retry || action ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {retry ? (
            <Button variant="secondary" iconStart={<RotateCcw aria-hidden />} onClick={retry}>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
      {reference ? <p className="mono-label mt-1 text-ink-muted">{reference}</p> : null}
    </div>
  )
}
