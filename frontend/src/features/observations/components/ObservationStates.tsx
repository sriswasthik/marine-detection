import { CircleX, Inbox, ScanSearch, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles, EmptyState, ErrorState, Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors/appError'
import { hasResult } from '../status'
import type { Observation } from '../types'

/**
 * In place of results for an observation that has none: processing failed, or it is still
 * queued or processing. Renders nothing for an observation with results.
 */
export function ObservationStatusState({
  observation,
  headingLevel = 2,
  className,
}: {
  observation: Pick<Observation, 'status'>
  headingLevel?: 1 | 2 | 3
  className?: string
}) {
  if (hasResult(observation)) return null
  const box = cn('rounded-card border border-border bg-surface', className)
  if (observation.status === 'failed') {
    return (
      <section className={box}>
        <EmptyState
          icon={<CircleX />}
          headingLevel={headingLevel}
          title="Processing failed"
          description="The analysis stopped before it produced a result, so there are no detections or measurements for this image. Upload it again to retry."
          action={
            <Link to="/analyze" className={buttonStyles({ variant: 'primary' })}>
              Analyze new imagery
            </Link>
          }
        />
      </section>
    )
  }
  return (
    <section className={box}>
      <EmptyState
        icon={<Spinner />}
        headingLevel={headingLevel}
        title={observation.status === 'queued' ? 'Waiting to be processed' : 'Still processing'}
        description="Results appear here when the analysis finishes. This usually takes under a minute."
      />
    </section>
  )
}

/** A link or id that matches no observation. */
export function ObservationNotFound({
  id,
  headingLevel = 1,
  className,
}: {
  id: string | undefined
  headingLevel?: 1 | 2 | 3
  className?: string
}) {
  return (
    <EmptyState
      icon={<SearchX />}
      headingLevel={headingLevel}
      className={className}
      title="Observation not found"
      description={`No observation has the id “${id ?? ''}”. The link may be wrong, or the observation was removed.`}
      action={
        <>
          <Link to="/observations" className={buttonStyles({ variant: 'primary' })}>
            View observations
          </Link>
          <Link to="/analyze" className={buttonStyles({ variant: 'secondary' })}>
            Analyze new imagery
          </Link>
        </>
      }
    />
  )
}

/** A failed load, with the specific reason and a retry when trying again can help. */
export function LoadError({
  error,
  onRetry,
  headingLevel = 2,
  className,
}: {
  error: unknown
  onRetry: () => void
  headingLevel?: 1 | 2 | 3
  className?: string
}) {
  return (
    <ErrorState
      error={toAppError(error, { retry: onRetry })}
      headingLevel={headingLevel}
      className={className}
    />
  )
}

/** No observations at all yet: the way in is to analyze an image or load a sample. */
export function NoObservations({
  headingLevel = 2,
  title = 'No observations yet',
  description = 'Analyze a satellite or drone image to see detections, density and where to inspect first.',
  className,
}: {
  headingLevel?: 1 | 2 | 3
  title?: string
  description?: string
  className?: string
}) {
  return (
    <EmptyState
      headingLevel={headingLevel}
      icon={<Inbox />}
      title={title}
      description={description}
      className={className}
      action={
        <>
          <Link to="/analyze" className={buttonStyles({ variant: 'primary' })}>
            <ScanSearch aria-hidden />
            Analyze new imagery
          </Link>
          <Link to="/analyze?sample=1" className={buttonStyles({ variant: 'secondary' })}>
            Load a sample scene
          </Link>
        </>
      }
    />
  )
}
