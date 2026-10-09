import {
  PageSkeleton,
  Skeleton,
  SkeletonFigures,
  SkeletonMap,
  SkeletonPageHeader,
  SkeletonSection,
  SkeletonTable,
} from '@/components/ui'
import { KPI_CELL_3, KPI_ROW_3 } from '@/features/overview/kpiLayout'

/** The detail page's own shape, so nothing jumps when the observation arrives. */
export function DetailSkeleton() {
  return (
    <PageSkeleton label="Loading observation" className="flex flex-col gap-8">
      <Skeleton className="mt-4 h-4 w-64 max-w-full" />
      <SkeletonPageHeader />
      <SkeletonMap className="h-[380px] w-full border border-rule md:h-[520px]" />
      <Skeleton className="h-28 w-full" />
      <SkeletonFigures count={6} className={KPI_ROW_3} itemClassName={KPI_CELL_3} />
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-12">
          <SkeletonSection lines={4} />
          <SkeletonSection>
            <SkeletonTable rows={8} />
          </SkeletonSection>
        </div>
        <div className="flex flex-col gap-12">
          <SkeletonSection>
            <SkeletonMap controls={false} className="h-40" />
          </SkeletonSection>
          <SkeletonSection lines={6} />
        </div>
      </div>
    </PageSkeleton>
  )
}
