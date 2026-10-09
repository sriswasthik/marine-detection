import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Ledger,
  SectionLabel,
  SeveritySwatch,
  SeverityTag,
  type LedgerColumn,
} from '@/components/ui'
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
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={
          withDebris.length > 0
            ? `Share of debris area by density level: ${withDebris
                .map((s) => `${s.label} ${s.percentLabel}`)
                .join(', ')}.`
            : 'No debris area to divide by density level.'
        }
        className="flex h-2 w-full overflow-hidden bg-hairline"
      >
        {withDebris.map((segment) => (
          <span
            key={segment.level}
            className={cn(
              'h-full min-w-[3px] border-l border-paper first:border-l-0',
              SEGMENT_CLASSES[segment.level],
            )}
            style={{ width: `${segment.percent}%` }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.level} className="flex min-w-0 flex-col">
            <dt className="flex items-center gap-2 text-small text-ink-2">
              <SeveritySwatch level={segment.level} />
              {segment.label}
            </dt>
            <dd className="data text-ink">
              <span>{segment.percentLabel}</span>
              <span className="text-ink-2"> · {fmt.area(segment.areaM2)}</span>
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
      <p className="text-small text-ink-2">
        No hotspots: no group of grid cells reaches a density worth a dedicated inspection.
      </p>
    )
  }
  const shown = hotspots.slice(0, MAX_HOTSPOT_ROWS)
  // Phones: rank, level, area and the map link; regions and confidence from 640px.
  const columns: LedgerColumn<Hotspot>[] = [
    { id: 'rank', header: 'Rank', numeric: true, render: (h) => h.rank, className: 'w-12' },
    {
      id: 'density',
      header: 'Density',
      render: (h) => <SeverityTag level={h.level} variant="plain" />,
    },
    { id: 'area', header: 'Area', numeric: true, render: (h) => fmt.area(h.totalAreaM2) },
    {
      id: 'regions',
      header: 'Regions',
      numeric: true,
      render: (h) => formatInteger(h.detectionIds.length),
      className: 'max-sm:hidden',
    },
    {
      id: 'confidence',
      header: 'Confidence',
      numeric: true,
      render: (h) => formatConfidence(h.meanConfidence),
      className: 'max-sm:hidden',
    },
    {
      id: 'map',
      header: '',
      render: (h) => (
        <Link
          to={hotspotMapPath(observationId, h.id)}
          className="hit-area inline-flex items-center gap-1 font-medium whitespace-nowrap text-accent-ink underline-offset-4 hover:underline"
        >
          Show on map
          <ArrowRight aria-hidden className="size-3" />
          <span className="sr-only">: hotspot {h.rank}</span>
        </Link>
      ),
      className: 'text-right',
    },
  ]
  return (
    <div className="flex flex-col gap-2">
      <Ledger
        caption="Hotspots ranked by priority"
        columns={columns}
        rows={shown}
        rowKey={(h) => h.id}
      />
      {hotspots.length > shown.length ? (
        <p className="text-small text-ink-2">
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
    <section aria-labelledby="density-title" className="flex flex-col gap-4">
      <SectionLabel id="density-title">Density and hotspots</SectionLabel>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {level ? (
            <SeverityTag level={level} />
          ) : (
            <span className="text-body font-medium text-ink-2">No debris</span>
          )}
          <p className="min-w-0 flex-1 basis-60 text-small text-ink-2">
            {densitySummaryText(level, observation.detections.length)}
          </p>
        </div>
        <DensityShareBar segments={densityShares(byLevel)} />
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-medium text-ink">Hotspots by priority</h3>
          <HotspotTable observationId={observation.id} hotspots={hotspots} />
        </div>
      </div>
    </section>
  )
}
