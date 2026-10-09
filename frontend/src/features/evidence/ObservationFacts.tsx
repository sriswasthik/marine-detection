import { ArrowLink, InfoTip, SectionLabel, Tag } from '@/components/ui'
import { MapPreview } from '@/features/map'
import type { Observation } from '@/features/observations/types'
import type { ObservationAnalysis } from '@/lib/analysis'
import { cn } from '@/lib/cn'
import { extentFacts, provenanceRows, type FactRow } from '@/lib/evidence'
import { formatConfidence } from '@/lib/format'
import { GLOSSARY } from '@/lib/glossary'
import { useSettings } from '@/features/settings/settingsContext'

const EXTENT_LAYERS = {
  detections: true,
  density: false,
  hotspots: false,
  footprint: true,
} as const

export function FactList({ rows, className }: { rows: FactRow[]; className?: string }) {
  return (
    <dl className={cn('flex flex-col text-small', className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 border-b border-hairline py-2"
        >
          <dt className="flex shrink-0 items-center gap-1 text-ink-2">
            {row.label}
            {row.hint ? <InfoTip label={row.label}>{row.hint}</InfoTip> : null}
          </dt>
          <dd className={cn('min-w-0 text-right break-words text-ink', row.mono ? 'data' : 'num')}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Exact bounds, CRS, footprint area and a small map of where the image sits. */
export function ExtentSection({
  observation,
  analysis,
}: {
  observation: Observation
  analysis: ObservationAnalysis
}) {
  // The helpers below read the unit settings; subscribing re-renders on a change.
  useSettings()
  const facts = extentFacts(observation)
  return (
    <section aria-labelledby="extent-title" className="flex flex-col gap-4">
      <SectionLabel id="extent-title">Geographic extent</SectionLabel>
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {facts.edges.map((edge) => (
            <div key={edge.label} className="flex flex-col">
              <dt className="text-small text-ink-2">{edge.label}</dt>
              <dd className="data text-ink">{edge.value}</dd>
            </div>
          ))}
        </dl>
        <FactList
          rows={[
            {
              label: 'Coordinate system',
              value: facts.crs,
              mono: observation.crs !== null,
              hint: GLOSSARY.crs,
            },
            { label: 'Footprint area', value: facts.footprintArea },
          ]}
        />
        <MapPreview
          observation={observation}
          analysis={analysis}
          visibleLayers={EXTENT_LAYERS}
          className="h-40"
        />
        <ArrowLink
          to={`/map/${encodeURIComponent(observation.id)}`}
          size="sm"
          className="self-start"
        >
          Open full map
        </ArrowLink>
      </div>
    </section>
  )
}

/** Which model produced the result, when, and from what. */
export function ProvenanceSection({ observation }: { observation: Observation }) {
  return (
    <section aria-labelledby="provenance-title" className="flex flex-col gap-4">
      <SectionLabel id="provenance-title">Provenance</SectionLabel>
      <FactList rows={provenanceRows(observation)} />
    </section>
  )
}

/**
 * Evaluation figures for the model. Rendered only when the observation carries them; placeholder
 * figures are labelled "Sample values" so they are never read as real results.
 */
export function ModelQualitySection({ observation }: { observation: Observation }) {
  const metrics = observation.modelMetrics
  if (!metrics) return null
  const figures = [
    { label: 'Precision', value: metrics.precision, hint: GLOSSARY.precision },
    { label: 'Recall', value: metrics.recall, hint: GLOSSARY.recall },
    { label: 'F1 score', value: metrics.f1, hint: GLOSSARY.f1 },
    { label: 'Accuracy', value: metrics.accuracy, hint: GLOSSARY.accuracy },
  ]
  return (
    <section aria-labelledby="quality-title" className="flex flex-col gap-4">
      <SectionLabel
        id="quality-title"
        action={metrics.isPlaceholder ? <Tag tone="warning">Sample values</Tag> : null}
      >
        Model quality
      </SectionLabel>
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col">
              <dt className="flex items-center gap-1 text-small text-ink-2">
                {figure.label}
                <InfoTip label={figure.label}>{figure.hint}</InfoTip>
              </dt>
              <dd className="num text-title text-ink">{formatConfidence(figure.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-small text-ink-2">
          <span className="font-medium text-ink">Benchmark: </span>
          {metrics.benchmark}
        </p>
        {metrics.isPlaceholder ? (
          <p className="text-small text-warning">
            These are placeholder figures, not an evaluation of this model.
          </p>
        ) : null}
      </div>
    </section>
  )
}
