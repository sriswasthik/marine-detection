import { ArrowRight, CircleCheck } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge, buttonStyles, MetricCard, SeveritySwatch } from '@/components/ui'
import { MapPreview } from '@/features/map'
import { SourceIcon } from '@/features/observations/components/SourceIcon'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '@/features/observations/labels'
import { DENSITY_LEVEL_IDS, type Observation } from '@/features/observations/types'
import { ObservationNotices } from '@/features/observations/components/ObservationNotices'
import { ObservationStatusState } from '@/features/observations/components/ObservationStates'
import { hasResult } from '@/features/observations/status'
import { analyzeObservation, type ObservationAnalysis } from '@/lib/analysis'
import { DENSITY_LEVELS } from '@/lib/density'
import { ENV } from '@/lib/env'
import { formatArea, formatDateTime } from '@/lib/format'
import { observationKpis, type Kpi } from '@/lib/kpis'
import type { VisibleLayers } from '@/lib/map/layers'
import { InspectNext } from './InspectNext'

const PREVIEW_LAYERS: VisibleLayers = {
  detections: true,
  hotspots: true,
  footprint: true,
  density: false,
}

function LevelKey() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
      {DENSITY_LEVEL_IDS.map((level) => (
        <span key={level} className="inline-flex items-center gap-1.5">
          <SeveritySwatch level={level} />
          {DENSITY_LEVELS[level].label}
        </span>
      ))}
      <span>Numbers rank hotspots by priority.</span>
    </p>
  )
}

/**
 * The observation in view: header, four headline figures, the map preview and what to
 * inspect next.
 */
export function LatestObservation({
  observation,
  isLatest,
  partialData = false,
}: {
  observation: Observation
  /** True when this is the most recent observation, not one picked in the top bar. */
  isLatest: boolean
  /** Some detections failed validation and were dropped. */
  partialData?: boolean
}) {
  const analysis = useMemo(() => analyzeObservation(observation), [observation])
  const kpis = observationKpis(observation, analysis.hotspots)
  const mapPath = `/map/${encodeURIComponent(observation.id)}`
  const noDebris = observation.detections.length === 0

  return (
    <section aria-labelledby="latest-title" className="flex flex-col gap-6">
      <ObservationNotices observation={observation} partialData={partialData} />
      <header className="flex flex-col gap-1.5">
        <p className="text-caption font-medium tracking-wide text-ink-muted uppercase">
          {isLatest ? 'Latest observation' : 'Selected observation'}
        </p>
        <h2 id="latest-title" className="text-title text-ink">
          {observation.region}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <SourceIcon source={observation.source} className="size-4" />
            {SOURCE_LABELS[observation.source]}
          </span>
          <span aria-hidden>·</span>
          <span className="num">{formatDateTime(observation.capturedAt)}</span>
          <Badge tone={STATUS_TONES[observation.status]} dot>
            {STATUS_LABELS[observation.status]}
          </Badge>
          {ENV.useMock ? <Badge tone="warning">Sample data</Badge> : null}
        </div>
      </header>

      {hasResult(observation) ? (
        <ObservationResult
          observation={observation}
          analysis={analysis}
          kpis={kpis}
          mapPath={mapPath}
          noDebris={noDebris}
        />
      ) : (
        <ObservationStatusState observation={observation} />
      )}
    </section>
  )
}

function ObservationResult({
  observation,
  analysis,
  kpis,
  mapPath,
  noDebris,
}: {
  observation: Observation
  analysis: ObservationAnalysis
  kpis: Kpi[]
  mapPath: string
  noDebris: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <MetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            hint={kpi.hint}
            footnote={kpi.footnote}
          />
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-10">
        <section aria-labelledby="preview-title" className="flex flex-col gap-3">
          <div className="flex h-8 items-center justify-between gap-3">
            <h3 id="preview-title" className="text-heading text-ink">
              On the map
            </h3>
            <Link to={mapPath} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>
              Open map
              <ArrowRight aria-hidden />
            </Link>
          </div>
          <div className="group relative">
            <MapPreview
              observation={observation}
              analysis={analysis}
              visibleLayers={PREVIEW_LAYERS}
              className="h-72 sm:h-80"
              overlay={
                noDebris ? (
                  <p className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-small text-ink shadow-subtle">
                    <CircleCheck aria-hidden className="size-4 text-success" />
                    No debris detected in {formatArea(observation.waterAreaM2)} of water
                  </p>
                ) : null
              }
            />
            {/* The whole preview opens the map; the map itself is not interactive. */}
            <Link
              to={mapPath}
              aria-label={`Open the map for ${observation.region}`}
              className="absolute inset-0 z-[700] rounded-card transition-shadow duration-150 ease-out group-hover:shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
            />
          </div>
          <LevelKey />
        </section>

        <InspectNext observation={observation} hotspots={analysis.hotspots} />
      </div>
    </>
  )
}
