import { Skeleton, SkeletonFigures, SkeletonMap, SkeletonText } from '@/components/ui'
import { KPI_CELL, KPI_ROW } from './kpiLayout'

/** Loading layout that matches the latest observation block: header, four figures, map, list. */
export function LatestObservationSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonFigures count={4} className={KPI_ROW} itemClassName={KPI_CELL} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-28" />
          <SkeletonMap controls={false} className="h-72 border border-rule sm:h-80" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-28" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** The recent list: heading, then rows at the real row height. */
export function RecentObservationsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <div className="divide-y divide-hairline border-y border-hairline">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="py-4">
            <SkeletonText lines={2} className="max-w-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
