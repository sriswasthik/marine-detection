import { NextStep } from '@/app/shell/NextStep'
import { ErrorBoundary, PageSkeleton } from '@/components/ui'
import { LoadError, NoObservations } from '@/features/observations/components/ObservationStates'
import { useCurrentObservationId } from '@/features/observations/currentObservationContext'
import { useObservation, useObservations } from '@/features/observations/hooks'
import { IntroBand } from '@/features/overview/IntroBand'
import { LatestObservation } from '@/features/overview/LatestObservation'
import {
  LatestObservationSkeleton,
  RecentObservationsSkeleton,
} from '@/features/overview/OverviewSkeleton'
import { RecentObservations } from '@/features/overview/RecentObservations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * Overview: what was detected, where, how severe, and what to inspect next.
 * Follows the observation picked in the top bar; defaults to the most recent one.
 */
export function OverviewPage() {
  useDocumentTitle('Overview')
  const list = useObservations()
  const observations = list.data?.data
  const currentId = useCurrentObservationId(observations)
  const detail = useObservation(currentId)
  const latestId = observations?.[0]?.id ?? null

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-12 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <IntroBand latestMapPath={currentId ? `/map/${encodeURIComponent(currentId)}` : null} />

      <div className="h-px bg-rule" aria-hidden />

      {list.isPending ? (
        <PageSkeleton label="Loading observations" className="flex flex-col gap-14">
          <LatestObservationSkeleton />
          <RecentObservationsSkeleton />
        </PageSkeleton>
      ) : list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : !observations || observations.length === 0 ? (
        <NoObservations />
      ) : (
        <>
          {detail.isError ? (
            <LoadError error={detail.error} onRetry={() => void detail.refetch()} />
          ) : detail.data ? (
            <ErrorBoundary label="The selected observation" resetKeys={[detail.data.data.id]}>
              <LatestObservation
                observation={detail.data.data}
                isLatest={detail.data.data.id === latestId}
                partialData={detail.data.issues.length > 0}
              />
            </ErrorBoundary>
          ) : (
            <PageSkeleton label="Loading observation">
              <LatestObservationSkeleton />
            </PageSkeleton>
          )}
          <ErrorBoundary label="Recent observations">
            <RecentObservations observations={observations} />
          </ErrorBoundary>
        </>
      )}
      <NextStep page="overview" observationId={currentId} />
    </div>
  )
}
