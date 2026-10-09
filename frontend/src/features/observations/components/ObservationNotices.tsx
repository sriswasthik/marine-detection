import { Banner } from '@/components/ui'
import { cn } from '@/lib/cn'
import { observationNotices, type NoticeId } from '@/lib/warnings'
import type { Observation } from '../types'

/**
 * The caveats that come with a result (low confidence, approximate positions, partial data, cloud,
 * resolution), one warning banner each. Every surface that shows a result uses this, so the
 * wording and the low-confidence rule are the same everywhere.
 */
export function ObservationNotices({
  observation,
  partialData = false,
  only,
  className,
  bannerClassName,
  size = 'md',
}: {
  observation: Observation
  /** Some detections failed validation and were dropped. */
  partialData?: boolean
  /** Show just these notices, for surfaces with little room (the map). */
  only?: readonly NoticeId[]
  className?: string
  bannerClassName?: string
  /** Banner size: `sm` for side panels. */
  size?: 'md' | 'sm'
}) {
  const notices = observationNotices(observation, { partialData, only })
  if (notices.length === 0) return null
  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="observation-notices">
      {notices.map((notice) => (
        <Banner
          key={notice.id}
          tone="warning"
          size={size}
          title={notice.title}
          className={bannerClassName}
        >
          {notice.message}
        </Banner>
      ))}
    </div>
  )
}
