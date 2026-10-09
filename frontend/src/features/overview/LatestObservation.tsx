import { CircleCheck } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLink, Measure, SectionLabel, SeveritySwatch, Tag } from '@/components/ui'
import { MapPreview } from '@/features/map'
import { ProvenanceTag } from '@/features/observations/components/ProvenanceTag'
import { SourceIcon } from '@/features/observations/components/SourceIcon'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '@/features/observations/labels'
import { DENSITY_LEVEL_IDS, type Observation } from '@/features/observations/types'
import { ObservationNotices } from '@/features/observations/components/ObservationNotices'
import { ObservationStatusState } from '@/features/observations/components/ObservationStates'
import { hasResult } from '@/features/observations/status'
import { analyzeObservation, type ObservationAnalysis } from '@/lib/analysis'
import { DENSITY_LEVELS } from '@/lib/density'
import { ENV } from '@/lib/env'
import { formatDateTime } from '@/lib/format'
import { observationKpis, type Kpi } from '@/lib/kpis'
import type { VisibleLayers } from '@/lib/map/layers'
import { InspectNext } from './InspectNext'
import { KPI_CELL, KPI_ROW } from './kpiLayout'
import { useFormat } from '@/features/settings/settingsContext'
import { useSettings } from '@/features/settings/settingsContext'

const PREVIEW_LAYERS: VisibleLayers = {
  detections: true,
  hotspots: true,
  footprint: true,
  density: false,
}

function LevelKey() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-2">
      {DENSITY_LEVEL_IDS.map((level) => (
        <span key={level} className="inline-flex items-center gap-2">
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
  // The helpers below read the unit settings; subscribing re-renders on a change.
  useSettings()
  const analysis = useMemo(() => analyzeObservation(observation), [observation])
  const kpis = observationKpis(observation, analysis.hotspots)
  const mapPath = `/map/${encodeURIComponent(observation.id)}`
  const noDebris = observation.detections.length === 0

  return (
    <section aria-labelledby="latest-title" className="flex flex-col gap-6">
      <ObservationNotices observation={observation} partialData={partialData} />
      <header className="flex flex-col gap-2">
        <p className="label text-ink-2">
          {isLatest ? 'Latest observation' : 'Selected observation'}
        </p>
        <h2 id="latest-title" className="text-title text-ink">
          {observation.region}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-ink-2">
          <span className="inline-flex items-center gap-2">
            <SourceIcon source={observation.source} className="size-4" />
            {SOURCE_LABELS[observation.source]}
          </span>
          <span aria-hidden>·</span>
          <span className="data">{formatDateTime(observation.capturedAt)}</span>
          <Tag tone={STATUS_TONES[observation.status]}>{STATUS_LABELS[observation.status]}</Tag>
          <ProvenanceTag observation={observation} mockMode={ENV.useMock} />
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
  const fmt = useFormat()
  return (
    <>
      <div className={KPI_ROW}>
        {kpis.map((kpi) => (
          <Measure
            key={kpi.id}
            size="page"
            className={KPI_CELL}
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
          <SectionLabel
            id="preview-title"
            as="h3"
            action={
              <ArrowLink to={mapPath} size="sm">
                Open map
              </ArrowLink>
            }
          >
            On the map
          </SectionLabel>
          <div className="group relative">
            <MapPreview
              observation={observation}
              analysis={analysis}
              visibleLayers={PREVIEW_LAYERS}
              className="h-72 sm:h-80"
              overlay={
                noDebris ? (
                  <p className="flex items-center gap-2 border border-rule bg-sheet px-3 py-2 text-small text-ink">
                    <CircleCheck aria-hidden className="size-4 text-success" />
                    No debris detected in {fmt.area(observation.waterAreaM2)} of water
                  </p>
                ) : null
              }
            />
            {/* The whole preview opens the map; the map itself is not interactive. */}
            <Link
              to={mapPath}
              aria-label={`Open the map for ${observation.region}`}
              className="absolute inset-0 z-[700] transition-shadow duration-[120ms] ease-out group-hover:shadow-[inset_0_0_0_1px_var(--color-ink)]"
            />
          </div>
          <LevelKey />
        </section>

        <InspectNext observation={observation} hotspots={analysis.hotspots} />
      </div>
    </>
  )
}
