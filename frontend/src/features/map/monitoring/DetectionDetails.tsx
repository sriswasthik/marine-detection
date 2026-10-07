import { Copy } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ConfidenceBadge, IconButton, SeverityBadge, Button } from '@/components/ui'
import { SourceIcon } from '@/features/observations/components/SourceIcon'
import { SOURCE_LABELS } from '@/features/observations/labels'
import type { Detection, Observation } from '@/features/observations/types'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatArea, formatCoordinates, formatDateTime, formatInteger } from '@/lib/format'
import { countVertices, geometryBounds } from '@/lib/geo'
import { detectionFeature, toGeoJsonText } from '@/lib/export/geojson'
import { confidenceBand, CONFIDENCE_BAND_MEANINGS } from '@/lib/stats'
import { TraceView } from './TraceView'
import { useCopy } from './useCopy'
import { useFormat } from '@/features/settings/settingsContext'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-caption font-medium tracking-wide text-ink-muted uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3 text-small">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  )
}

function CopyValue({ value, what }: { value: string; what: string }) {
  const copy = useCopy()
  return (
    <span className="flex items-center gap-1">
      <span className="mono-label min-w-0 break-words text-ink">{value}</span>
      <IconButton
        label={`Copy ${what.toLowerCase()}`}
        icon={<Copy aria-hidden />}
        size="sm"
        tooltipSide="top"
        className="size-7 shrink-0"
        onClick={() => void copy(value, what)}
      />
    </span>
  )
}

export interface DetectionDetailsProps {
  detection: Detection
  observation: Observation
  onShowOnMap: () => void
}

/** Detection facts, traceability and geometry, in the order an inspector needs them. */
export function DetectionDetails({ detection, observation, onShowOnMap }: DetectionDetailsProps) {
  const fmt = useFormat()
  const copy = useCopy()
  const band = confidenceBand(detection.confidence)
  const box = geometryBounds(detection.geometry)

  return (
    <div className="flex flex-col gap-5">
      <Section title="Key facts">
        <dl className="flex flex-col gap-2.5">
          <Fact label="Area">
            <span className="num font-medium">{formatArea(detection.areaM2, { unit: 'm2' })}</span>{' '}
            <span className="num text-ink-muted">
              {formatArea(detection.areaM2, { unit: 'ha' })}
            </span>
          </Fact>
          <Fact label="Confidence">
            <span className="flex flex-col items-start gap-1">
              <ConfidenceBadge value={detection.confidence} />
              <span className="text-caption text-ink-muted">{CONFIDENCE_BAND_MEANINGS[band]}</span>
            </span>
          </Fact>
          <Fact label="Density level">
            <span className="flex flex-col items-start gap-1">
              <SeverityBadge level={detection.densityLevel} />
              <span className="text-caption text-ink-muted">
                {DENSITY_LEVELS[detection.densityLevel].meaning}
              </span>
            </span>
          </Fact>
          <Fact label="Centroid">
            <span className="flex flex-col gap-0.5">
              <CopyValue
                value={formatCoordinates(detection.centroid, { format: 'decimal' })}
                what="Coordinates"
              />
              <CopyValue
                value={formatCoordinates(detection.centroid, { format: 'dms' })}
                what="DMS coordinates"
              />
            </span>
          </Fact>
          <Fact label="Source pixels">
            <span className="num">{formatInteger(detection.sourcePixelCount)}</span>
          </Fact>
          <Fact label="Observation">
            <Link
              to={`/observations/${encodeURIComponent(observation.id)}`}
              className="font-medium text-accent hover:underline"
            >
              {observation.name ?? observation.region}
            </Link>
          </Fact>
          <Fact label="Source">
            <span className="flex items-center gap-1.5">
              <SourceIcon source={observation.source} className="size-4 text-ink-muted" />
              {SOURCE_LABELS[observation.source]}
              <span className="text-ink-muted">· {formatDateTime(observation.capturedAt)}</span>
            </span>
          </Fact>
        </dl>
      </Section>

      <Section title="Trace this detection">
        <TraceView detection={detection} observationId={observation.id} onShowOnMap={onShowOnMap} />
      </Section>

      <Section title="Geometry">
        <dl className="flex flex-col gap-2.5">
          <Fact label="Vertices">
            <span className="num">{formatInteger(countVertices(detection.geometry))}</span>
          </Fact>
          <Fact label="Bounding box">
            <span className="flex flex-col gap-0.5">
              <span className="mono-label">
                <span className="sr-only">North-east corner: </span>
                {fmt.coordinates({ lat: box.north, lng: box.east })}
              </span>
              <span className="mono-label">
                <span className="sr-only">South-west corner: </span>
                {fmt.coordinates({ lat: box.south, lng: box.west })}
              </span>
            </span>
          </Fact>
        </dl>
        <Button
          size="sm"
          variant="secondary"
          iconStart={<Copy aria-hidden />}
          className="self-start"
          onClick={() =>
            void copy(toGeoJsonText(detectionFeature(detection, observation)), 'GeoJSON')
          }
        >
          Copy GeoJSON
        </Button>
      </Section>
    </div>
  )
}
