import './report.css'
import { CircleCheck } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Badge, SeverityBadge, SeveritySwatch } from '@/components/ui'
import { DensityShareBar } from '@/features/evidence/DensitySummary'
import { MapPreview } from '@/features/map'
import { SOURCE_LABELS } from '@/features/observations/labels'
import { DENSITY_LEVEL_IDS, type Observation } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { gridCellSizeForResolution } from '@/lib/config'
import { DENSITY_LEVELS } from '@/lib/density'
import { densityShares, densitySummaryText, evidenceMetrics } from '@/lib/evidence'
import { methodAndCaveats, REPORT_TOP_HOTSPOTS, reportAttributions } from '@/lib/export/report'
import {
  formatArea,
  formatConfidence,
  formatCoordinates,
  formatDateTime,
  formatInteger,
} from '@/lib/format'
import type { BasemapId } from '@/lib/map/basemaps'
import { observationNotices } from '@/lib/warnings'

const REPORT_LAYERS = { detections: true, density: false, hotspots: true, footprint: true } as const

function Block({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`mwi-report-block flex flex-col gap-1.5 ${className ?? ''}`}>
      {title ? (
        <h2 className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  )
}

export interface ReportSheetProps {
  observation: Observation
  partialData: boolean
  basemap: BasemapId
  sampleData: boolean
  generatedAt: Date
  appName: string
  /** Fires each time the map's tiles have finished loading. */
  onMapReady: () => void
}

/**
 * The one-page A4 report: header, static map with numbered hotspots, six figures, density
 * classification, the top hotspots with coordinates, method and caveats, attributions.
 */
export function ReportSheet({
  observation,
  partialData,
  basemap,
  sampleData,
  generatedAt,
  appName,
  onMapReady,
}: ReportSheetProps) {
  const analysis = useMemo(() => analyzeObservation(observation), [observation])
  const metrics = evidenceMetrics(observation, analysis.hotspots.length)
  const notices = observationNotices(observation, { partialData })
  const noDebris = observation.detections.length === 0
  const level = noDebris ? null : observation.densityLevel
  const top = analysis.hotspots.slice(0, REPORT_TOP_HOTSPOTS)

  return (
    <article
      aria-label={`Report for ${observation.region}`}
      className="mwi-report-sheet flex flex-col gap-3.5 rounded-card border border-border text-ink shadow-subtle"
    >
      <header className="mwi-report-block flex items-start justify-between gap-4 border-b border-border pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
            Marine debris report
          </p>
          <h1 className="text-title text-ink">{observation.region}</h1>
          <p className="text-small text-ink-muted">
            Captured <span className="num">{formatDateTime(observation.capturedAt)}</span> ·{' '}
            {SOURCE_LABELS[observation.source]} imagery
            {observation.crs ? ` · ${observation.crs}` : ''}
          </p>
        </div>
        {sampleData ? <Badge tone="warning">Sample data</Badge> : null}
      </header>

      {notices.length > 0 ? (
        <ul
          data-testid="observation-notices"
          className="mwi-report-block flex flex-col gap-0.5 rounded-control border border-warning/25 bg-warning-soft px-3 py-2 text-caption text-ink"
        >
          {notices.map((notice) => (
            <li key={notice.id}>
              <span className="font-semibold">{notice.title}</span>. {notice.message}
            </li>
          ))}
        </ul>
      ) : null}

      {noDebris ? (
        <p className="mwi-report-block flex items-center gap-2 rounded-control border border-border px-3 py-2 text-small">
          <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
          <span>
            <span className="font-medium">No debris detected.</span> The model checked{' '}
            {formatArea(observation.waterAreaM2)} of water; no cleanup is needed for this area.
          </span>
        </p>
      ) : null}

      <Block>
        <MapPreview
          observation={observation}
          analysis={analysis}
          basemap={basemap}
          visibleLayers={REPORT_LAYERS}
          onBasemapLoad={onMapReady}
          className="h-[74mm]"
        />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
          {DENSITY_LEVEL_IDS.map((id) => (
            <span key={id} className="inline-flex items-center gap-1">
              <SeveritySwatch level={id} />
              {DENSITY_LEVELS[id].label}
            </span>
          ))}
          <span>Numbers rank hotspots by priority. Dashed outlines are low confidence.</span>
        </p>
      </Block>

      <Block title="Measurements">
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
          {metrics.map((metric) => (
            <div key={metric.id} className="flex flex-col border-l-2 border-border pl-2.5">
              <dt className="text-caption text-ink-muted">{metric.label}</dt>
              <dd className="num text-heading text-ink">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <Block title="Density classification">
        <div className="flex items-center gap-3">
          {level ? <SeverityBadge level={level} /> : <Badge>No debris</Badge>}
          <p className="text-small text-ink-muted">
            {densitySummaryText(level, observation.detections.length)}
          </p>
        </div>
        <DensityShareBar segments={densityShares(analysis.stats.byLevel)} />
      </Block>

      <Block title={`Top ${REPORT_TOP_HOTSPOTS} hotspots`}>
        {top.length === 0 ? (
          <p className="text-small text-ink-muted">
            No hotspots: no group of grid cells reaches a density worth a dedicated inspection.
          </p>
        ) : (
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border text-left text-caption text-ink-muted">
                <th scope="col" className="py-1 pr-2 font-medium">
                  Rank
                </th>
                <th scope="col" className="py-1 pr-2 font-medium">
                  Density
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Area
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Regions
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Confidence
                </th>
                <th scope="col" className="py-1 font-medium">
                  Centre
                </th>
              </tr>
            </thead>
            <tbody>
              {top.map((hotspot) => (
                <tr key={hotspot.id} className="border-b border-border last:border-0">
                  <td className="num py-1 pr-2 font-medium">{hotspot.rank}</td>
                  <td className="py-1 pr-2">
                    <SeverityBadge level={hotspot.level} variant="plain" />
                  </td>
                  <td className="num py-1 pr-2 text-right">{formatArea(hotspot.totalAreaM2)}</td>
                  <td className="num py-1 pr-2 text-right">
                    {formatInteger(hotspot.detectionIds.length)}
                  </td>
                  <td className="num py-1 pr-2 text-right">
                    {formatConfidence(hotspot.meanConfidence)}
                  </td>
                  <td className="mono-label py-1 whitespace-nowrap">
                    {formatCoordinates(hotspot.centroid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <Block title="Method and caveats">
        <p className="text-caption leading-relaxed text-ink">
          {methodAndCaveats({
            sampleData,
            cellSizeM: gridCellSizeForResolution(observation.resolutionM),
          }).join(' ')}
        </p>
      </Block>

      <footer className="mwi-report-block mt-auto flex flex-col gap-0.5 border-t border-border pt-2 text-caption text-ink-muted">
        {reportAttributions({
          basemap,
          source: observation.source,
          sampleData,
          capturedAt: observation.capturedAt,
        }).map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>
          Generated <span className="num">{formatDateTime(generatedAt)}</span> by {appName} ·
          Observation <span className="mono-label">{observation.id}</span>
        </p>
      </footer>
    </article>
  )
}
