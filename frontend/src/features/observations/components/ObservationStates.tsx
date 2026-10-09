import { ArrowLink, Button, EmptyState, ErrorState, Spinner } from '@/components/ui'
import {
  useSettings,
  useSettingsStore,
  useUpdateSettings,
} from '@/features/settings/settingsContext'
import { cn } from '@/lib/cn'
import { toAppError, type AppError } from '@/lib/errors/appError'
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
  const box = cn('border-t border-rule', className)
  if (observation.status === 'failed') {
    return (
      <section className={box}>
        <EmptyState
          headingLevel={headingLevel}
          title="Processing failed"
          description="The analysis stopped before it produced a result, so there are no detections or measurements for this image. Upload it again to retry."
          action={<ArrowLink to="/analyze">Upload it again</ArrowLink>}
        />
      </section>
    )
  }
  return (
    <section className={box}>
      <EmptyState
        headingLevel={headingLevel}
        title={
          <span className="inline-flex items-center gap-3">
            <Spinner size="lg" label={null} />
            {observation.status === 'queued' ? 'Waiting to be processed' : 'Still processing'}
          </span>
        }
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
      headingLevel={headingLevel}
      className={className}
      title="Observation not found"
      description={`No observation has the id “${id ?? ''}”. The link may be wrong, or the observation was removed.`}
      action={<ArrowLink to="/observations">View observations</ArrowLink>}
    />
  )
}

/** Failures where the live service, not the request, is the problem: sample data still works. */
const SERVICE_PROBLEMS: ReadonlySet<AppError['code']> = new Set([
  'NETWORK',
  'OFFLINE',
  'TIMEOUT',
  'SERVICE_UNAVAILABLE',
  'SERVER',
  'NOT_IMPLEMENTED',
  'INVALID_RESPONSE',
])

/**
 * A failed load, with the specific reason and a retry when trying again can help. When the live
 * service is the problem, it also offers to switch to sample data so the demo can go on.
 */
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
  const settings = useSettings()
  const update = useUpdateSettings()
  const appError = toAppError(error, { retry: onRetry })
  const store = useSettingsStore()
  // Sample data is offered only where the environment allows it, never in place of real results.
  const offerSamples =
    store.sampleDataAllowed() &&
    settings.dataSource === 'live' &&
    SERVICE_PROBLEMS.has(appError.code)
  return (
    <ErrorState
      error={appError}
      headingLevel={headingLevel}
      className={className}
      action={
        offerSamples ? (
          <Button variant="tertiary" onClick={() => update({ dataSource: 'mock' })}>
            Switch to sample data
          </Button>
        ) : undefined
      }
    />
  )
}

/**
 * The way in from an empty list. On sample data it loads a sample scene; on the live service,
 * where observations are only the images analysed so far, it goes to Analyze.
 */
export function StartLink() {
  const sampleData = useSettings().dataSource === 'mock'
  return sampleData ? (
    <ArrowLink to="/analyze?sample=1">Load a sample scene</ArrowLink>
  ) : (
    <ArrowLink to="/analyze">Analyze an image</ArrowLink>
  )
}

/** No observations at all yet. */
export function NoObservations({
  headingLevel = 2,
  title = 'No observations yet',
  description = 'Analyze a Sentinel-2 image to see detections, density and where to inspect first.',
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
      title={title}
      description={description}
      className={className}
      action={<StartLink />}
    />
  )
}
