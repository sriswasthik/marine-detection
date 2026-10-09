import { useQueryClient } from '@tanstack/react-query'
import { RefreshCcw } from 'lucide-react'
import { useMemo } from 'react'
import { NextStep } from '@/app/shell/NextStep'
import {
  Banner,
  Button,
  EmptyState,
  ErrorBoundary,
  PageSkeleton,
  SkeletonTable,
  Tag,
} from '@/components/ui'
import { useCurrentObservationId } from '@/features/observations/currentObservationContext'
import { isMockMode } from '@/features/observations/api'
import { LoadError, NoObservations } from '@/features/observations/components/ObservationStates'
import { observationKeys, useObservations } from '@/features/observations/hooks'
import { ObservationFilters } from '@/features/observations/list/ObservationFilters'
import { ObservationsTable } from '@/features/observations/list/ObservationsTable'
import { useListQuery } from '@/features/observations/list/useListQuery'
import { setMockScenario } from '@/features/observations/mock/scenario'
import { formatInteger } from '@/lib/format'
import { filterList, isFiltered, sortList } from '@/lib/observationList'
import { PageContainer, PageHeader } from './PageHeader'

/** In mock mode, an empty list can be filled with the six sample scenes. */
function LoadSamplesButton() {
  const queryClient = useQueryClient()
  return (
    <Button
      variant="secondary"
      iconStart={<RefreshCcw aria-hidden />}
      onClick={() => {
        setMockScenario('success')
        void queryClient.invalidateQueries({ queryKey: observationKeys.list() })
      }}
    >
      Load sample scenes
    </Button>
  )
}

/**
 * Every observation in one quiet table: search, filters for source, status and density, sorting by
 * every column. All of it lives in the URL, so a reload or a shared link shows the same list.
 */
export function ObservationsPage() {
  const list = useObservations()
  const { query, update, reset } = useListQuery()
  const all = list.data?.data
  const shown = useMemo(
    () => (all ? sortList(filterList(all, query), query.sort, query.direction) : []),
    [all, query],
  )
  const issues = list.data?.issues.length ?? 0
  const mock = isMockMode()
  const currentId = useCurrentObservationId(all)

  let body
  if (list.isPending) {
    body = (
      <PageSkeleton label="Loading observations" className="flex flex-col gap-4">
        <SkeletonTable rows={6} columns={8} />
      </PageSkeleton>
    )
  } else if (list.isError) {
    body = <LoadError error={list.error} onRetry={() => void list.refetch()} />
  } else if (!all || all.length === 0) {
    body = (
      <div className="flex flex-col items-start">
        <NoObservations />
        {mock ? <LoadSamplesButton /> : null}
      </div>
    )
  } else {
    body = (
      <ErrorBoundary label="The observation list">
        <div className="flex flex-col gap-4">
          <ObservationFilters query={query} onChange={update} onReset={reset} />
          {issues > 0 ? (
            <Banner tone="warning" title="Partial data">
              Some observations could not be read and are left out of this list.
            </Banner>
          ) : null}
          <div className="flex items-center gap-2 text-small text-ink-2" aria-live="polite">
            <span>
              {isFiltered(query)
                ? `${formatInteger(shown.length)} of ${formatInteger(all.length)} observations`
                : `${formatInteger(all.length)} ${all.length === 1 ? 'observation' : 'observations'}`}
            </span>
            {mock ? <Tag tone="warning">Sample data</Tag> : null}
          </div>
          {shown.length === 0 ? (
            <EmptyState
              headingLevel={2}
              title="No observations match these filters"
              description="Widen the search or turn off some filters to see more."
              action={
                <Button variant="secondary" onClick={reset}>
                  Reset filters
                </Button>
              }
            />
          ) : (
            <ObservationsTable observations={shown} query={query} onSort={(sort) => update(sort)} />
          )}
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader title="Observations" description="Every processed image, newest first." />
        {body}
        <NextStep page="observations" observationId={currentId} />
      </div>
    </PageContainer>
  )
}
