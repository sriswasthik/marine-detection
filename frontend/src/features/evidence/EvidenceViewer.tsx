import { Maximize, Minus, Plus, X } from 'lucide-react'
import { useRef, useState, type CSSProperties } from 'react'
import {
  EmptyState,
  IconButton,
  SegmentedControl,
  SeverityBadge,
  Slider,
  Switch,
} from '@/components/ui'
import { MapView, type MapHandle } from '@/features/map'
import { NoDebrisCard } from '@/features/map/monitoring/NoDebrisCard'
import type { Detection, Observation } from '@/features/observations/types'
import type { ObservationAnalysis } from '@/lib/analysis'
import { cn } from '@/lib/cn'
import type { EvidenceSource } from '@/lib/evidence'
import { formatArea, formatConfidence, shortId } from '@/lib/format'
import { EvidenceMap } from './EvidenceMap'
import {
  EVIDENCE_MODE_DESCRIPTIONS,
  EVIDENCE_MODE_LABELS,
  EVIDENCE_MODES,
  type EvidenceMode,
} from './modes'
import { SwipeCompare } from './SwipeCompare'

const MODE_OPTIONS = EVIDENCE_MODES.map((mode) => ({
  value: mode,
  label: EVIDENCE_MODE_LABELS[mode],
}))

const GEOGRAPHIC_LAYERS = {
  detections: true,
  density: false,
  hotspots: true,
  footprint: true,
} as const

/** Facts for the clicked detection, over the viewer. */
function SelectionReadout({ detection, onClose }: { detection: Detection; onClose: () => void }) {
  return (
    <div
      role="status"
      aria-label="Selected detection"
      className="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2 shadow-popover"
    >
      <span className="mono-label text-ink" title={detection.id}>
        {shortId(detection.id)}
      </span>
      <SeverityBadge level={detection.densityLevel} variant="plain" />
      <dl className="flex items-center gap-3 text-caption">
        <div className="flex gap-1">
          <dt className="text-ink-muted">Confidence</dt>
          <dd className="num font-medium text-ink">{formatConfidence(detection.confidence)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-ink-muted">Area</dt>
          <dd className="num font-medium text-ink">{formatArea(detection.areaM2)}</dd>
        </div>
      </dl>
      <IconButton
        label="Clear selection"
        icon={<X aria-hidden />}
        size="sm"
        tooltip={false}
        onClick={onClose}
        className="-my-1 -mr-1"
      />
    </div>
  )
}

export interface EvidenceViewerProps {
  observation: Observation
  analysis: ObservationAnalysis
  source: EvidenceSource
  mode: EvidenceMode
  onModeChange: (mode: EvidenceMode) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Row hovered in the detections table. */
  highlightedId: string | null
  /** Zoom request for the geographic view, from a table row or ?detection=. */
  focusRequest: { detectionId: string; key: number } | null
}

/**
 * The evidence hero: the source image, the model's segmentation, a swipe comparison of the two and
 * the geographic result, with a detection overlay toggle and its opacity.
 */
export function EvidenceViewer({
  observation,
  analysis,
  source,
  mode,
  onModeChange,
  selectedId,
  onSelect,
  highlightedId,
  focusRequest,
}: EvidenceViewerProps) {
  const [showOverlay, setShowOverlay] = useState(true)
  const [opacity, setOpacity] = useState(100)
  const mapRef = useRef<MapHandle | null>(null)
  const { detections } = observation
  const hasDebris = detections.length > 0
  const selected = detections.find((d) => d.id === selectedId) ?? null
  const overlayControlsOff = mode === 'original' || !hasDebris
  const frameStyle = { '--mwi-overlay-opacity': String(opacity / 100) } as CSSProperties

  const fitted = (look: 'original' | 'segmentation' | 'overlay', interactive: boolean) =>
    source.bounds ? (
      <EvidenceMap
        bounds={source.bounds}
        previewUrl={source.previewUrl}
        detections={detections}
        showDetections={look !== 'original' && showOverlay}
        look={look}
        selectedId={selectedId}
        highlightedId={highlightedId}
        onSelect={interactive ? onSelect : undefined}
        label={`${EVIDENCE_MODE_LABELS[mode]} view of ${observation.region}`}
      />
    ) : null

  let content
  if (!source.bounds) {
    content = (
      <EmptyState
        title="This image could not be placed"
        description="It has no bounds and no detections to locate it, so there is nothing to draw."
        className="h-full justify-center"
      />
    )
  } else if (mode === 'compare') {
    content = (
      <SwipeCompare
        beforeLabel="Original"
        afterLabel="With segmentation"
        before={fitted('original', false)}
        after={fitted('overlay', true)}
      />
    )
  } else if (mode === 'geographic') {
    content = (
      <>
        <MapView
          ref={mapRef}
          observation={observation}
          analysis={analysis}
          basemap="satellite"
          visibleLayers={{ ...GEOGRAPHIC_LAYERS, detections: showOverlay }}
          selectedDetectionId={selectedId}
          highlightedDetectionId={highlightedId}
          onSelectDetection={onSelect}
          focusRequest={focusRequest}
          wheelZoom={false}
          className="h-full w-full"
        />
        <div className="absolute top-3 right-3 z-[600] flex flex-col overflow-hidden rounded-control border border-border bg-surface shadow-subtle">
          <IconButton
            label="Zoom in"
            icon={<Plus aria-hidden />}
            tooltipSide="bottom"
            onClick={() => mapRef.current?.zoomIn()}
            className="rounded-none"
          />
          <IconButton
            label="Zoom out"
            icon={<Minus aria-hidden />}
            onClick={() => mapRef.current?.zoomOut()}
            className="rounded-none border-t border-border"
          />
          <IconButton
            label="Fit to image"
            icon={<Maximize aria-hidden />}
            onClick={() => mapRef.current?.resetView()}
            className="rounded-none border-t border-border"
          />
        </div>
      </>
    )
  } else {
    content = fitted(mode === 'original' ? 'original' : 'segmentation', mode !== 'original')
  }

  return (
    <section aria-labelledby="evidence-title" className="flex flex-col gap-3">
      <h2 id="evidence-title" className="sr-only">
        Evidence
      </h2>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <SegmentedControl
          label="Evidence view"
          size="sm"
          options={MODE_OPTIONS}
          value={mode}
          onChange={onModeChange}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Switch
            label="Detections"
            checked={showOverlay && hasDebris}
            onCheckedChange={setShowOverlay}
            disabled={overlayControlsOff}
            labelPosition="start"
          />
          <Slider
            label="Overlay opacity"
            min={10}
            max={100}
            step={5}
            value={opacity}
            onChange={setOpacity}
            disabled={overlayControlsOff || !showOverlay}
            formatValue={(value) => `${value}%`}
            className="w-44"
          />
        </div>
      </div>

      <div
        style={frameStyle}
        className="mwi-evidence-frame relative isolate h-[380px] overflow-hidden rounded-card border border-border bg-map-fallback md:h-[520px]"
      >
        {content}
        {selected ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[600] max-w-[calc(100%-1.5rem)]">
            <div className="pointer-events-auto">
              <SelectionReadout detection={selected} onClose={() => onSelect(null)} />
            </div>
          </div>
        ) : null}
        {!hasDebris && source.bounds ? (
          <div className="pointer-events-none absolute inset-0 z-[600] flex items-center justify-center p-4">
            <div className="pointer-events-auto">
              <NoDebrisCard observation={observation} />
            </div>
          </div>
        ) : null}
      </div>

      <div className={cn('flex flex-col gap-0.5 text-caption text-ink-muted')}>
        <p>{EVIDENCE_MODE_DESCRIPTIONS[mode]}</p>
        {source.caption ? <p>{source.caption}</p> : null}
      </div>
    </section>
  )
}
