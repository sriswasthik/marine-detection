import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card } from '@/components/ui'
import { MapPreview } from '@/features/map'
import type { Observation } from '@/features/observations/types'
import type { ObservationAnalysis } from '@/lib/analysis'
import { cn } from '@/lib/cn'
import { extentFacts, provenanceRows, type FactRow } from '@/lib/evidence'
import { formatConfidence } from '@/lib/format'

const EXTENT_LAYERS = {
  detections: true,
  density: false,
  hotspots: false,
  footprint: true,
} as const

function FactList({ rows, className }: { rows: FactRow[]; className?: string }) {
  return (
    <dl className={cn('flex flex-col text-small', className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 border-b border-border py-1.5 last:border-0"
        >
          <dt className="shrink-0 text-ink-muted">{row.label}</dt>
          <dd
            className={cn(
              'min-w-0 text-right break-words text-ink',
              row.mono ? 'mono-label' : 'num',
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Exact bounds, CRS, footprint area and a small map of where the image sits. */
export function ExtentCard({
  observation,
  analysis,
}: {
  observation: Observation
  analysis: ObservationAnalysis
}) {
  const facts = extentFacts(observation)
  return (
    <Card title="Geographic extent" headingLevel={2}>
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {facts.edges.map((edge) => (
            <div key={edge.label} className="flex flex-col">
              <dt className="text-caption text-ink-muted">{edge.label}</dt>
              <dd className="mono-label text-ink">{edge.value}</dd>
            </div>
          ))}
        </dl>
        <FactList
          rows={[
            { label: 'Coordinate system', value: facts.crs, mono: observation.crs !== null },
            { label: 'Footprint area', value: facts.footprintArea },
          ]}
        />
        <MapPreview
          observation={observation}
          analysis={analysis}
          visibleLayers={EXTENT_LAYERS}
          className="h-40"
        />
        <Link
          to={`/map/${encodeURIComponent(observation.id)}`}
          className="inline-flex items-center gap-1 self-start rounded-[4px] text-small font-medium text-accent hover:underline"
        >
          Open full map
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}

/** Which model produced the result, when, and from what. */
export function ProvenanceCard({ observation }: { observation: Observation }) {
  return (
    <Card title="Provenance" headingLevel={2}>
      <FactList rows={provenanceRows(observation)} />
    </Card>
  )
}

/**
 * Evaluation figures for the model. Rendered only when the observation carries them; placeholder
 * figures are labelled "Sample values" so they are never read as real results.
 */
export function ModelQualityCard({ observation }: { observation: Observation }) {
  const metrics = observation.modelMetrics
  if (!metrics) return null
  const figures = [
    { label: 'Precision', value: metrics.precision },
    { label: 'Recall', value: metrics.recall },
    { label: 'F1 score', value: metrics.f1 },
    { label: 'Accuracy', value: metrics.accuracy },
  ]
  return (
    <Card
      title="Model quality"
      headingLevel={2}
      actions={metrics.isPlaceholder ? <Badge tone="warning">Sample values</Badge> : null}
    >
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col">
              <dt className="text-caption text-ink-muted">{figure.label}</dt>
              <dd className="num text-heading text-ink">{formatConfidence(figure.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-caption text-ink-muted">
          <span className="font-medium text-ink">Benchmark: </span>
          {metrics.benchmark}
        </p>
        {metrics.isPlaceholder ? (
          <p className="text-caption text-warning">
            These are placeholder figures, not an evaluation of this model.
          </p>
        ) : null}
      </div>
    </Card>
  )
}
