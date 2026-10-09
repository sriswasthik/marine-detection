import { ArrowLink, SectionLabel } from '@/components/ui'
import {
  ObservationListHeader,
  ObservationRow,
} from '@/features/observations/components/ObservationRow'
import type { ObservationSummary } from '@/features/observations/types'

const RECENT_LIMIT = 5

/** The most recent observations as ledger rows separated by hairlines, newest first. */
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
      <SectionLabel
        id="recent-title"
        count={recent.length}
        action={
          <ArrowLink to="/observations" size="sm">
            View all
          </ArrowLink>
        }
      >
        Recent observations
      </SectionLabel>
      <div>
        <ObservationListHeader />
        <ul className="divide-y divide-hairline border-b border-hairline">
          {recent.map((observation) => (
            <li key={observation.id}>
              <ObservationRow observation={observation} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
