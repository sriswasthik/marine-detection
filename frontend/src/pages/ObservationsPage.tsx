import { Badge, Banner, ErrorBoundary, PageSkeleton, Skeleton, SkeletonText } from '@/components/ui'
import { isMockMode } from '@/features/observations/api'
import {
  ObservationCard,
  ObservationListHeader,
} from '@/features/observations/components/ObservationCard'
import { LoadError, NoObservations } from '@/features/observations/components/ObservationStates'
import { useObservations } from '@/features/observations/hooks'
import { formatInteger } from '@/lib/format'
import { PageContainer, PageHeader } from './PageHeader'

/** Rows at the real row height, under the real column header. */
function ObservationListSkeleton() {
  return (
    <PageSkeleton label="Loading observations">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <div className="divide-y divide-border border-y border-border">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <SkeletonText lines={2} className="max-w-sm flex-1" />
              <Skeleton className="hidden h-6 w-24 md:block" />
              <Skeleton className="hidden h-4 w-14 md:block" />
              <Skeleton className="hidden h-4 w-10 md:block" />
            </div>
          ))}
        </div>
      </div>
    </PageSkeleton>
  )
}

/**
 * Every observation, newest first. Each row carries its caveats (low confidence, approximate
 * positions), its density or "No debris", and its status (processing, failed) as badges.
 */
export function ObservationsPage() {
  const list = useObservations()
  const observations = [...(list.data?.data ?? [])].sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  )
  const issues = list.data?.issues.length ?? 0

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader title="Observations" description="Every processed image, newest first." />
        {list.isPending ? (
          <ObservationListSkeleton />
        ) : list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : observations.length === 0 ? (
          <NoObservations />
        ) : (
          <ErrorBoundary label="The observation list">
            <section aria-labelledby="list-title" className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 id="list-title" className="text-small text-ink-muted">
                  {formatInteger(observations.length)}{' '}
                  {observations.length === 1 ? 'observation' : 'observations'}
                </h2>
                {isMockMode() ? <Badge tone="warning">Sample data</Badge> : null}
              </div>
              {issues > 0 ? (
                <Banner tone="warning" title="Partial data">
                  Some observations could not be read and are left out of this list.
                </Banner>
              ) : null}
              <div>
                <ObservationListHeader />
                <ul className="divide-y divide-border border-y border-border">
                  {observations.map((observation) => (
                    <li key={observation.id}>
                      <ObservationCard observation={observation} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </ErrorBoundary>
        )}
      </div>
    </PageContainer>
  )
}
