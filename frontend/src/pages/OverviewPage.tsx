import { Inbox, ScanSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles, EmptyState, ErrorState } from '@/components/ui'
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
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-14 px-4 py-10 sm:px-6 lg:py-14">
      <IntroBand latestMapPath={currentId ? `/map/${encodeURIComponent(currentId)}` : null} />

      <div className="h-px bg-border" aria-hidden />

      {list.isPending ? (
        <>
          <LatestObservationSkeleton />
          <RecentObservationsSkeleton />
        </>
      ) : list.isError ? (
        <ErrorState
          title="Observations could not load"
          description="The list of observations did not arrive. Check your connection and try again."
          onRetry={() => void list.refetch()}
        />
      ) : !observations || observations.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<Inbox />}
          title="No observations yet"
          description="Analyze a satellite or drone image to see detections, density and where to inspect first."
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
      ) : (
        <>
          {detail.isError ? (
            <ErrorState
              title="This observation could not load"
              description="The details did not arrive. Check your connection and try again, or pick another observation in the top bar."
              onRetry={() => void detail.refetch()}
            />
          ) : detail.data ? (
            <LatestObservation
              observation={detail.data.data}
              isLatest={detail.data.data.id === latestId}
            />
          ) : (
            <LatestObservationSkeleton />
          )}
          <RecentObservations observations={observations} />
        </>
      )}
    </div>
  )
}
