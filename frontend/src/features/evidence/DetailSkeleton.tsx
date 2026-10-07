import {
  PageSkeleton,
  Skeleton,
  SkeletonCard,
  SkeletonMap,
  SkeletonMetricCards,
  SkeletonPageHeader,
  SkeletonTable,
} from '@/components/ui'

/** The detail page's own shape, so nothing jumps when the observation arrives. */
export function DetailSkeleton() {
  return (
    <PageSkeleton label="Loading observation" className="flex flex-col gap-6">
      <SkeletonPageHeader breadcrumb />
      <Skeleton className="h-8 w-96 max-w-full" />
      <SkeletonMap className="h-[380px] w-full rounded-card border border-border md:h-[520px]" />
      <div className="flex gap-3">
        <Skeleton className="h-28 flex-1" />
        <Skeleton className="h-28 flex-1" />
        <Skeleton className="h-28 flex-1" />
      </div>
      <SkeletonMetricCards count={6} className="grid grid-cols-2 gap-3 lg:grid-cols-3" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <SkeletonCard lines={4} />
          <SkeletonCard>
            <SkeletonTable rows={8} />
          </SkeletonCard>
        </div>
        <div className="flex flex-col gap-6">
          <SkeletonCard>
            <SkeletonMap controls={false} className="h-40 rounded-card" />
          </SkeletonCard>
          <SkeletonCard lines={6} />
        </div>
      </div>
    </PageSkeleton>
  )
}
