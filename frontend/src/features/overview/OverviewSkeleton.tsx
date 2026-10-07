import { Skeleton, SkeletonText } from '@/components/ui'

/** Loading layout that matches the latest observation block and the recent list. */
export function LatestObservationSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-72 w-full rounded-card sm:h-80" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function RecentObservationsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <div className="divide-y divide-border border-y border-border">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="py-4">
            <SkeletonText lines={2} className="max-w-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
