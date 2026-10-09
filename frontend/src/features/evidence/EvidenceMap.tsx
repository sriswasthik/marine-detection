import 'leaflet/dist/leaflet.css'
import '@/features/map/map.css'
import '@/features/map/leafletPatches'
import './evidence.css'
import { svg, type LatLngBoundsExpression, type Map as LeafletMap } from 'leaflet'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AttributionControl,
  ImageOverlay,
  MapContainer,
  Pane,
  Polygon,
  useMap,
  useMapEvent,
} from 'react-leaflet'
import { BasemapLayer } from '@/features/map/layers/BasemapLayer'
import { DetectionsLayer } from '@/features/map/layers/DetectionsLayer'
import type { Detection, GeoBounds } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { boundsToLeaflet } from '@/lib/geo'
import { MAP_COLORS, MAP_MAX_ZOOM, MAP_MIN_ZOOM, type BasemapId } from '@/lib/map/basemaps'

export type EvidenceLook = 'original' | 'segmentation' | 'overlay'

/** Keeps the view fitted to the image bounds whenever the container changes size. */
function FitToBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap()
  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ animate: false })
      map.fitBounds(bounds, { animate: false })
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map, bounds])
  return null
}

function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvent('click', onClear)
  return null
}

/** The world outside the image, washed out so the image footprint stands out. */
function outsideMask(bounds: GeoBounds): [number, number][][] {
  return [
    [
      [89, -179.9],
      [89, 179.9],
      [-89, 179.9],
      [-89, -179.9],
    ],
    [
      [bounds.north, bounds.west],
      [bounds.north, bounds.east],
      [bounds.south, bounds.east],
      [bounds.south, bounds.west],
    ],
  ]
}

const MASK_STYLE = {
  stroke: false,
  fillColor: MAP_COLORS.fallback,
  fillOpacity: 0.72,
} as const

export interface EvidenceMapProps {
  /** Image footprint the view is fitted to. */
  bounds: GeoBounds
  /** Georeferenced source preview drawn on the bounds. Null falls back to satellite imagery. */
  previewUrl: string | null
  detections: readonly Detection[]
  showDetections: boolean
  /** Segmentation washes the imagery out so the model output reads like a mask. */
  look: EvidenceLook
  selectedId?: string | null
  highlightedId?: string | null
  /** Omit for a still picture: no hover, no click. */
  onSelect?: (id: string | null) => void
  /** Basemap under the preview, or instead of it. */
  basemap?: BasemapId
  attribution?: boolean
  label: string
  className?: string
}

const noop = () => {}

/**
 * A fitted, still view of the image footprint: no panning or zooming, so two of them stacked line
 * up exactly (the compare view relies on this). Detections stay clickable when `onSelect` is given.
 */
export const EvidenceMap = memo(function EvidenceMap({
  bounds,
  previewUrl,
  detections,
  showDetections,
  look,
  selectedId = null,
  highlightedId = null,
  onSelect,
  basemap = 'satellite',
  attribution = true,
  label,
  className,
}: EvidenceMapProps) {
  const leafletBounds = useMemo(() => boundsToLeaflet(bounds), [bounds])
  const mask = useMemo(() => outsideMask(bounds), [bounds])
  // SVG, not the shared canvas: a world-sized shape is cheap in SVG, and its own renderer keeps it
  // out of the detections canvas (and its redraw cycle) entirely.
  const maskRenderer = useMemo(() => svg({ pane: 'evidence-outside' }), [])
  const [basemapUnavailable, setBasemapUnavailable] = useState(false)
  const interactive = Boolean(onSelect)
  const select = useCallback((id: string) => onSelect?.(id), [onSelect])
  const clear = useCallback(() => onSelect?.(null), [onSelect])
  const onAvailabilityChange = useCallback(
    (_: BasemapId, available: boolean) => setBasemapUnavailable(!available),
    [],
  )

  const onMapReady = useCallback(
    (instance: LeafletMap | null) => {
      if (!instance) return
      const container = instance.getContainer()
      container.setAttribute('aria-label', label)
      container.removeAttribute('tabindex')
    },
    [label],
  )

  return (
    // State classes live on this wrapper: react-leaflet applies MapContainer's className only once.
    <div
      className={cn(
        'relative isolate h-full w-full overflow-hidden bg-map-fallback',
        look === 'segmentation' && 'mwi-evidence--mask',
        basemapUnavailable && 'mwi-map--no-basemap',
        !interactive && 'mwi-evidence--still',
        className,
      )}
    >
      <MapContainer
        ref={onMapReady}
        bounds={leafletBounds}
        zoomSnap={0}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        preferCanvas
        fadeAnimation={false}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
        className="mwi-map h-full w-full"
      >
        <FitToBounds bounds={leafletBounds} />
        {attribution ? <AttributionControl position="bottomright" prefix={false} /> : null}
        <BasemapLayer key={basemap} basemap={basemap} onAvailabilityChange={onAvailabilityChange} />
        {previewUrl ? (
          <Pane name="evidence-image" style={{ zIndex: 250 }}>
            <ImageOverlay url={previewUrl} bounds={leafletBounds} />
          </Pane>
        ) : null}
        <Pane name="evidence-outside" style={{ zIndex: 300 }}>
          <Polygon
            positions={mask}
            pathOptions={MASK_STYLE}
            renderer={maskRenderer}
            interactive={false}
          />
        </Pane>
        {showDetections ? (
          <DetectionsLayer
            detections={detections}
            selectedId={selectedId}
            highlightedId={highlightedId}
            interactive={interactive}
            onImagery={look !== 'segmentation'}
            onSelect={interactive ? select : noop}
          />
        ) : null}
        {interactive ? <ClearOnMapClick onClear={clear} /> : null}
      </MapContainer>
      {basemapUnavailable ? (
        <p className="pointer-events-none absolute bottom-2 left-2 z-[500] border border-hairline bg-sheet px-2 py-1 text-small text-ink-2">
          Basemap unavailable, detections are still shown
        </p>
      ) : null}
    </div>
  )
})
