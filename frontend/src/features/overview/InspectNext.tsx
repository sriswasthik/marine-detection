import { ChevronRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Banner, SeverityBadge } from '@/components/ui'
import { RankDot } from '@/features/map/monitoring/InspectionPriority'
import type { Observation } from '@/features/observations/types'
import { formatArea, formatCoordinates } from '@/lib/format'
import type { Hotspot } from '@/lib/hotspots'
import { describeWarnings } from '@/lib/warnings'

const INSPECT_LIMIT = 3

/** The top ranked hotspots, each opening the map with that hotspot selected, plus warnings. */
export function InspectNext({
  observation,
  hotspots,
}: {
  observation: Observation
  hotspots: readonly Hotspot[]
}) {
  const top = hotspots.slice(0, INSPECT_LIMIT)
  const warnings = describeWarnings(observation)
  const mapPath = (hotspotId: string) =>
    `/map/${encodeURIComponent(observation.id)}?h=${encodeURIComponent(hotspotId)}`

  return (
    <section aria-labelledby="inspect-next-title" className="flex flex-col gap-3">
      <div className="flex h-8 items-center justify-between gap-3">
        <h3 id="inspect-next-title" className="text-heading text-ink">
          Inspect next
        </h3>
        <p className="text-caption text-ink-muted">Ranked by priority score</p>
      </div>

      {top.length > 0 ? (
        <ol className="flex flex-col border-t border-border">
          {top.map((hotspot) => (
            <li key={hotspot.id} className="border-b border-border">
              <Link
                to={mapPath(hotspot.id)}
                className="group flex items-center gap-3 py-3 transition-colors duration-150 ease-out hover:bg-surface md:-mx-2 md:px-2"
              >
                <RankDot hotspot={hotspot} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="sr-only">Hotspot {hotspot.rank}, </span>
                    <SeverityBadge level={hotspot.level} />
                    <span className="num ml-auto text-small font-medium text-ink">
                      {formatArea(hotspot.totalAreaM2)}
                    </span>
                  </span>
                  <span className="mono-label truncate text-ink-muted">
                    {formatCoordinates(hotspot.centroid, { digits: 4 })}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-ink-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex items-start gap-3 border-y border-border py-4">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="text-small font-medium text-ink">Nothing to inspect</p>
            <p className="text-small text-ink-muted">
              {observation.detections.length === 0
                ? 'No debris was detected in this observation.'
                : 'Debris here is scattered at low density. No area stands out for a visit.'}
            </p>
          </div>
        </div>
      )}

      {warnings.length > 0 ? (
        <Banner tone="warning" title="Read these results with care">
          <ul className="mt-1 flex flex-col gap-1">
            {warnings.map((warning) => (
              <li key={warning.code}>
                <span className="font-medium">{warning.title}.</span> {warning.detail}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}
    </section>
  )
}
