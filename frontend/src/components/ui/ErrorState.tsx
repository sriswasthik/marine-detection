import { RotateCcw } from 'lucide-react'
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
  /**
   * The action when there is nothing to retry, or an alternative beside the retry (a tertiary
   * link, for example "Switch to sample data").
   */
  action?: ReactNode
  /** Technical reference such as an error code, shown small in mono for support. */
  details?: string
  size?: 'sm' | 'md'
  className?: string
  headingLevel?: 1 | 2 | 3
}

/**
 * Typographic failure: a danger rule, the title, what to do next and one action (retry when it
 * can help), with at most one alternative link. Never shows raw messages or stack traces.
 */
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
        'flex max-w-prose flex-col items-start border-l-2 border-danger pl-4',
        size === 'md' ? 'my-12 gap-2' : 'my-6 gap-1',
        className,
      )}
    >
      <Heading className={cn(size === 'md' ? 'text-title' : 'text-lead font-medium', 'text-ink')}>
        {shownTitle}
      </Heading>
      <p className={cn(size === 'md' ? 'text-lead' : 'text-body', 'text-ink-2')}>
        {shownDescription}
      </p>
      {retry || action ? (
        <div className="mt-4 flex flex-wrap items-center gap-6">
          {retry ? (
            <Button variant="secondary" iconStart={<RotateCcw aria-hidden />} onClick={retry}>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
      {reference ? <p className="data mt-2 text-ink-2">{reference}</p> : null}
    </div>
  )
}
