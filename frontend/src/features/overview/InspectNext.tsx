import { ChevronRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SectionLabel, SeverityTag } from '@/components/ui'
import { RankDot } from '@/features/map/monitoring/InspectNextLedger'
import type { Observation } from '@/features/observations/types'
import type { Hotspot } from '@/lib/hotspots'
import { useFormat } from '@/features/settings/settingsContext'

const INSPECT_LIMIT = 3

/** The top ranked hotspots, each opening the map with that hotspot selected. */
export function InspectNext({
  observation,
  hotspots,
}: {
  observation: Observation
  hotspots: readonly Hotspot[]
}) {
  const fmt = useFormat()
  const top = hotspots.slice(0, INSPECT_LIMIT)
  const mapPath = (hotspotId: string) =>
    `/map/${encodeURIComponent(observation.id)}?h=${encodeURIComponent(hotspotId)}`

  return (
    <section aria-labelledby="inspect-next-title" className="flex flex-col gap-3">
      <SectionLabel
        id="inspect-next-title"
        as="h3"
        action={<span className="text-small text-ink-2">Ranked by priority score</span>}
      >
        Inspect next
      </SectionLabel>

      {top.length > 0 ? (
        <ol className="flex flex-col border-t border-hairline">
          {top.map((hotspot) => (
            <li key={hotspot.id} className="border-b border-hairline">
              <Link
                to={mapPath(hotspot.id)}
                className="group flex items-center gap-3 py-3 transition-transform duration-[120ms] ease-out hover:translate-x-[2px]"
              >
                <RankDot hotspot={hotspot} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="sr-only">Hotspot {hotspot.rank}, </span>
                    <SeverityTag level={hotspot.level} />
                    <span className="data ml-auto text-ink">{fmt.area(hotspot.totalAreaM2)}</span>
                  </span>
                  <span className="data truncate text-ink-2">
                    {fmt.coordinates(hotspot.centroid, { digits: 4 })}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-2" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex items-start gap-3 border-y border-hairline py-4">
          <CircleCheck aria-hidden className="mt-1 size-4 shrink-0 text-success" />
          <div>
            <p className="text-small font-medium text-ink">Nothing to inspect</p>
            <p className="text-small text-ink-2">
              {observation.detections.length === 0
                ? 'No debris was detected in this observation.'
                : 'Debris here is scattered at low density. No area stands out for a visit.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
