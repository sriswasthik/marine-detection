import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/ui'
import {
  ObservationCard,
  ObservationListHeader,
} from '@/features/observations/components/ObservationCard'
import type { ObservationSummary } from '@/features/observations/types'

const RECENT_LIMIT = 5

/** The most recent observations as rows separated by hairlines, newest first. */
export function RecentObservations({
  observations,
}: {
  observations: readonly ObservationSummary[]
}) {
  const recent = [...observations]
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .slice(0, RECENT_LIMIT)

  return (
    <section aria-labelledby="recent-title" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="recent-title" className="text-title text-ink">
          Recent observations
        </h2>
        <Link to="/observations" className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
          View all
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <div>
        <ObservationListHeader />
        <ul className="divide-y divide-border border-y border-border">
          {recent.map((observation) => (
            <li key={observation.id}>
              <ObservationCard observation={observation} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
