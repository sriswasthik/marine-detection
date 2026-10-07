import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, SeverityBadge, SeveritySwatch } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { densityShares, densitySummaryText, type DensityShareSegment } from '@/lib/evidence'
import { formatConfidence, formatInteger } from '@/lib/format'
import type { Hotspot } from '@/lib/hotspots'
import { DEFAULT_MAP_URL_STATE, serializeMapSearch } from '@/lib/mapUrlState'
import type { LevelBreakdown } from '@/lib/stats'
import { useFormat } from '@/features/settings/settingsContext'

/** Shown in the table; the rest are one click away on the map. */
const MAX_HOTSPOT_ROWS = 5

const SEGMENT_CLASSES = {
  low: 'bg-low',
  moderate: 'bg-moderate',
  high: 'bg-high',
  critical: 'bg-critical',
} as const

/** One thin bar: the share of debris area per density level, with a labelled legend. */
export function DensityShareBar({ segments }: { segments: DensityShareSegment[] }) {
  const fmt = useFormat()
  const withDebris = segments.filter((s) => s.percent > 0)
  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="img"
        aria-label={
          withDebris.length > 0
            ? `Share of debris area by density level: ${withDebris
                .map((s) => `${s.label} ${s.percentLabel}`)
                .join(', ')}.`
            : 'No debris area to divide by density level.'
        }
        className="flex h-2.5 w-full gap-px overflow-hidden rounded-badge bg-border"
      >
        {withDebris.map((segment) => (
          <span
            key={segment.level}
            className={cn('h-full min-w-[3px]', SEGMENT_CLASSES[segment.level])}
            style={{ width: `${segment.percent}%` }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.level} className="flex min-w-0 flex-col">
            <dt className="flex items-center gap-1.5 text-caption text-ink-muted">
              <SeveritySwatch level={segment.level} />
              {segment.label}
            </dt>
            <dd className="num text-small text-ink">
              <span className="font-medium">{segment.percentLabel}</span>
              <span className="text-ink-muted"> · {fmt.area(segment.areaM2)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function hotspotMapPath(observationId: string, hotspotId: string): string {
  const search = serializeMapSearch({ ...DEFAULT_MAP_URL_STATE, hotspotId }).toString()
  return `/map/${encodeURIComponent(observationId)}?${search}`
}

function HotspotTable({ observationId, hotspots }: { observationId: string; hotspots: Hotspot[] }) {
  const fmt = useFormat()
  if (hotspots.length === 0) {
    return (
      <p className="text-small text-ink-muted">
        No hotspots: no group of grid cells reaches a density worth a dedicated inspection.
      </p>
    )
  }
  const shown = hotspots.slice(0, MAX_HOTSPOT_ROWS)
  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[30rem] text-small">
          <caption className="sr-only">Hotspots ranked by priority</caption>
          <thead>
            <tr className="border-b border-border text-left text-caption text-ink-muted">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Rank
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Density
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                Area
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                Regions
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-medium">
                Confidence
              </th>
              <th scope="col" className="py-1.5 font-medium">
                <span className="sr-only">Map</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((hotspot) => (
              <tr key={hotspot.id} className="border-b border-border last:border-0">
                <td className="num py-1.5 pr-3 font-medium text-ink">{hotspot.rank}</td>
                <td className="py-1.5 pr-3">
                  <SeverityBadge level={hotspot.level} variant="plain" />
                </td>
                <td className="num py-1.5 pr-3 text-right text-ink">
                  {fmt.area(hotspot.totalAreaM2)}
                </td>
                <td className="num py-1.5 pr-3 text-right text-ink">
                  {formatInteger(hotspot.detectionIds.length)}
                </td>
                <td className="num py-1.5 pr-3 text-right text-ink">
                  {formatConfidence(hotspot.meanConfidence)}
                </td>
                <td className="py-1.5 text-right">
                  <Link
                    to={hotspotMapPath(observationId, hotspot.id)}
                    className="inline-flex items-center gap-1 rounded-[4px] font-medium whitespace-nowrap text-accent hover:underline"
                  >
                    Show on map
                    <ArrowRight aria-hidden className="size-3.5" />
                    <span className="sr-only">: hotspot {hotspot.rank}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hotspots.length > shown.length ? (
        <p className="text-caption text-ink-muted">
          {formatInteger(hotspots.length - shown.length)} more on the map.
        </p>
      ) : null}
    </div>
  )
}

/** Observation density level, how the debris area divides by level, and the ranked hotspots. */
export function DensitySummary({
  observation,
  byLevel,
  hotspots,
}: {
  observation: Observation
  byLevel: readonly LevelBreakdown[]
  hotspots: Hotspot[]
}) {
  const level = observation.detections.length > 0 ? observation.densityLevel : null
  return (
    <Card title="Density and hotspots" headingLevel={2} padding="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {level ? (
            <SeverityBadge
              level={level}
              className="h-9 gap-2 px-3 text-body [&>span:first-child]:size-3.5"
            />
          ) : (
            <span className="inline-flex h-9 items-center rounded-badge border border-border bg-surface px-3 text-body font-medium text-ink-muted">
              No debris
            </span>
          )}
          <p className="min-w-0 flex-1 basis-60 text-small text-ink-muted">
            {densitySummaryText(level, observation.detections.length)}
          </p>
        </div>
        <DensityShareBar segments={densityShares(byLevel)} />
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-medium text-ink">Hotspots by priority</h3>
          <HotspotTable observationId={observation.id} hotspots={hotspots} />
        </div>
      </div>
    </Card>
  )
}
