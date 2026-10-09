import './report.css'
import { CircleCheck } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { SeveritySwatch, SeverityTag } from '@/components/ui'
import { DensityShareBar } from '@/features/evidence/DensitySummary'
import { MapPreview } from '@/features/map'
import { ProvenanceTag } from '@/features/observations/components/ProvenanceTag'
import { SOURCE_LABELS } from '@/features/observations/labels'
import { DENSITY_LEVEL_IDS, type Observation } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { gridCellSizeForResolution } from '@/lib/config'
import { DENSITY_LEVELS } from '@/lib/density'
import { densityShares, densitySummaryText, evidenceMetrics } from '@/lib/evidence'
import { methodAndCaveats, REPORT_TOP_HOTSPOTS, reportAttributions } from '@/lib/export/report'
import { formatConfidence, formatDateTime, formatInteger } from '@/lib/format'
import type { BasemapId } from '@/lib/map/basemaps'
import { observationProvenance } from '@/lib/provenance'
import { observationNotices } from '@/lib/warnings'
import { useFormat } from '@/features/settings/settingsContext'

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
    <section className={`mwi-report-block flex flex-col gap-2 ${className ?? ''}`}>
      {title ? <h2 className="label text-ink-2">{title}</h2> : null}
      {children}
    </section>
  )
}

export interface ReportSheetProps {
  observation: Observation
  partialData: boolean
  basemap: BasemapId
  /** True in mock mode. Synthetic scenes are then labelled "Sample data"; MARIDA output is labelled by patch. */
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
  const fmt = useFormat()
  const analysis = useMemo(() => analyzeObservation(observation), [observation])
  const metrics = evidenceMetrics(observation, analysis.hotspots.length)
  const notices = observationNotices(observation, { partialData })
  const provenance = observationProvenance(observation, sampleData)
  const noDebris = observation.detections.length === 0
  const level = noDebris ? null : observation.densityLevel
  const top = analysis.hotspots.slice(0, REPORT_TOP_HOTSPOTS)

  return (
    <article
      aria-label={`Report for ${observation.region}`}
      className="mwi-report-sheet flex flex-col gap-4 border border-hairline text-ink"
    >
      <header className="mwi-report-block flex items-start justify-between gap-4 border-b border-hairline pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="label text-ink-2">Marine debris report</p>
          <h1 className="text-page text-ink">{observation.region}</h1>
          <p className="text-small text-ink-2">
            Captured <span className="data">{formatDateTime(observation.capturedAt)}</span> ·{' '}
            {SOURCE_LABELS[observation.source]} imagery
            {observation.crs ? ` · ${observation.crs}` : ''}
          </p>
        </div>
        <ProvenanceTag observation={observation} mockMode={sampleData} />
      </header>

      {notices.length > 0 ? (
        <ul
          data-testid="observation-notices"
          className="mwi-report-block flex flex-col gap-1 border-l-2 border-warning py-1 pl-3 text-small text-ink"
        >
          {notices.map((notice) => (
            <li key={notice.id}>
              <span className="font-semibold">{notice.title}</span>. {notice.message}
            </li>
          ))}
        </ul>
      ) : null}

      {noDebris ? (
        <p className="mwi-report-block flex items-center gap-2 border-l-2 border-success py-1 pl-3 text-small">
          <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
          <span>
            <span className="font-medium">No debris detected.</span> The model checked{' '}
            {fmt.area(observation.waterAreaM2)} of water; no cleanup is needed for this area.
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
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-2">
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
            <div key={metric.id} className="flex flex-col border-l-2 border-hairline pl-3">
              <dt className="text-small text-ink-2">{metric.label}</dt>
              <dd className="num text-title text-ink">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <Block title="Density classification">
        <div className="flex items-center gap-3">
          {level ? (
            <SeverityTag level={level} />
          ) : (
            <span className="text-small font-medium text-ink-2">No debris</span>
          )}
          <p className="text-small text-ink-2">
            {densitySummaryText(level, observation.detections.length)}
          </p>
        </div>
        <DensityShareBar segments={densityShares(analysis.stats.byLevel)} />
      </Block>

      <Block title={`Top ${REPORT_TOP_HOTSPOTS} hotspots`}>
        {top.length === 0 ? (
          <p className="text-small text-ink-2">
            No hotspots: no group of grid cells reaches a density worth a dedicated inspection.
          </p>
        ) : (
          <table className="w-full text-small">
            <thead>
              <tr className="label border-b border-rule text-left text-ink-2">
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
                <tr key={hotspot.id} className="border-b border-hairline last:border-0">
                  <td className="data py-1 pr-2">{hotspot.rank}</td>
                  <td className="py-1 pr-2">
                    <SeverityTag level={hotspot.level} variant="plain" />
                  </td>
                  <td className="data py-1 pr-2 text-right">{fmt.area(hotspot.totalAreaM2)}</td>
                  <td className="data py-1 pr-2 text-right">
                    {formatInteger(hotspot.detectionIds.length)}
                  </td>
                  <td className="data py-1 pr-2 text-right">
                    {formatConfidence(hotspot.meanConfidence)}
                  </td>
                  <td className="data py-1 whitespace-nowrap">
                    {fmt.coordinates(hotspot.centroid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>

      <Block title="Method and caveats">
        <p className="text-small leading-relaxed text-ink">
          {methodAndCaveats({
            sampleData: provenance.kind === 'sample',
            modelOutput: provenance.kind === 'model' ? provenance : undefined,
            cellSizeM: gridCellSizeForResolution(observation.resolutionM),
          }).join(' ')}
        </p>
      </Block>

      <footer className="mwi-report-block mt-auto flex flex-col gap-1 border-t border-hairline pt-2 text-small text-ink-2">
        {reportAttributions({
          basemap,
          source: observation.source,
          sampleData: provenance.kind === 'sample',
          capturedAt: observation.capturedAt,
        }).map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>
          Generated <span className="data">{formatDateTime(generatedAt)}</span> by {appName} ·
          Observation <span className="data">{observation.id}</span>
        </p>
      </footer>
    </article>
  )
}
