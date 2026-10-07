import type { LeafletMouseEvent } from 'leaflet'
import { DomEvent, type Path } from 'leaflet'
import { memo, useCallback, useMemo, useState } from 'react'
import { CircleMarker, Polygon, useMap, useMapEvent } from 'react-leaflet'
import type { Detection } from '@/features/observations/types'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence } from '@/lib/format'
import { geometryToLeaflet, latLngToTuple } from '@/lib/geo'
import {
  detectionPointRadius,
  getDetectionStyle,
  getSelectionHaloStyle,
  type DetectionStyleState,
} from '@/lib/map/detectionStyle'
import {
  detectionRepresentation,
  geometryExtentM,
  type DetectionRepresentation,
} from '@/lib/map/representation'
import { HoverTooltip } from './HoverTooltip'
import { useFormat } from '@/features/settings/settingsContext'

interface ShapeProps {
  detection: Detection
  mode: DetectionRepresentation
  state: DetectionStyleState
  interactive: boolean
  /** Draw above everything else on the shared canvas (the selected detection). */
  front?: boolean
  onEnter: (id: string) => void
  onLeave: (id: string) => void
  onSelect: (id: string) => void
}

/** One detection, as a polygon or, when too small on screen, a centroid marker. */
const DetectionShape = memo(function DetectionShape({
  detection,
  mode,
  state,
  interactive,
  front = false,
  onEnter,
  onLeave,
  onSelect,
}: ShapeProps) {
  const positions = useMemo(() => geometryToLeaflet(detection.geometry), [detection.geometry])
  const style = getDetectionStyle(detection, state)
  const eventHandlers = useMemo(
    () => ({
      add: (event: { target: Path }) => {
        if (front) event.target.bringToFront()
      },
      ...(interactive
        ? {
            mouseover: () => onEnter(detection.id),
            mouseout: () => onLeave(detection.id),
            click: (event: LeafletMouseEvent) => {
              DomEvent.stopPropagation(event)
              onSelect(detection.id)
            },
          }
        : {}),
    }),
    [front, interactive, detection.id, onEnter, onLeave, onSelect],
  )

  if (mode === 'point') {
    return (
      <CircleMarker
        center={latLngToTuple(detection.centroid)}
        radius={detectionPointRadius(state)}
        pathOptions={{ ...style, weight: Math.min(style.weight, 2) }}
        interactive={interactive}
        bubblingMouseEvents={false}
        eventHandlers={eventHandlers}
      />
    )
  }
  return (
    <Polygon
      positions={positions}
      pathOptions={style}
      interactive={interactive}
      bubblingMouseEvents={false}
      eventHandlers={eventHandlers}
    />
  )
})

/** All vectors share one canvas, so draw order is managed explicitly. */
const BRING_TO_FRONT = { add: (event: { target: Path }) => event.target.bringToFront() }

export interface DetectionsLayerProps {
  detections: readonly Detection[]
  selectedId: string | null
  interactive: boolean
  /** Satellite basemap underneath: use the light outline style. */
  onImagery: boolean
  onSelect: (id: string) => void
  /** Detection to emphasise from outside the map, for example a hovered table row. */
  highlightedId?: string | null
}

/**
 * All detections on the shared vector canvas. Only the hovered and selected shapes re-render on
 * interaction; zoom changes swap tiny polygons for centroid markers.
 */
export const DetectionsLayer = memo(function DetectionsLayer({
  detections,
  selectedId,
  interactive,
  onImagery,
  onSelect,
  highlightedId = null,
}: DetectionsLayerProps) {
  const fmt = useFormat()
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  useMapEvent('zoomend', () => setZoom(map.getZoom()))

  const extents = useMemo(
    () => new Map(detections.map((d) => [d.id, geometryExtentM(d.geometry)])),
    [detections],
  )
  // Stable state objects, so memoised shapes only re-render when their own state changes.
  const idle = useMemo<DetectionStyleState>(
    () => ({ selected: false, hovered: false, onImagery }),
    [onImagery],
  )
  const hoveredState = useMemo<DetectionStyleState>(
    () => ({ selected: false, hovered: true, onImagery }),
    [onImagery],
  )
  const onEnter = useCallback((id: string) => setHoveredId(id), [])
  const onLeave = useCallback(
    (id: string) => setHoveredId((current) => (current === id ? null : current)),
    [],
  )

  const modeOf = (d: Detection) =>
    detectionRepresentation(extents.get(d.id) ?? 0, d.centroid.lat, zoom)
  const hovered = interactive ? detections.find((d) => d.id === hoveredId) : undefined
  const emphasisedId = hoveredId ?? highlightedId
  const selected = detections.find((d) => d.id === selectedId)

  return (
    <>
      {detections.map((detection) =>
        detection.id === selectedId ? null : (
          <DetectionShape
            key={detection.id}
            detection={detection}
            mode={modeOf(detection)}
            state={detection.id === emphasisedId ? hoveredState : idle}
            interactive={interactive}
            onEnter={onEnter}
            onLeave={onLeave}
            onSelect={onSelect}
          />
        ),
      )}
      {selected ? (
        <>
          {modeOf(selected) === 'polygon' ? (
            <Polygon
              positions={geometryToLeaflet(selected.geometry)}
              pathOptions={getSelectionHaloStyle()}
              interactive={false}
              eventHandlers={BRING_TO_FRONT}
            />
          ) : (
            <CircleMarker
              center={latLngToTuple(selected.centroid)}
              radius={detectionPointRadius({ selected: true, hovered: false }) + 2}
              pathOptions={getSelectionHaloStyle()}
              interactive={false}
              eventHandlers={BRING_TO_FRONT}
            />
          )}
          <DetectionShape
            key={`selected-${selected.id}`}
            detection={selected}
            mode={modeOf(selected)}
            state={{ selected: true, hovered: selected.id === emphasisedId, onImagery }}
            interactive={interactive}
            front
            onEnter={onEnter}
            onLeave={onLeave}
            onSelect={onSelect}
          />
        </>
      ) : null}
      {hovered ? (
        <HoverTooltip position={latLngToTuple(hovered.centroid)}>
          <div className="mwi-tooltip__row">
            <span className="mwi-tooltip__title">{DENSITY_LEVELS[hovered.densityLevel].label}</span>
            <span className="mwi-tooltip__muted">{fmt.area(hovered.areaM2)}</span>
          </div>
          <div className="mwi-tooltip__row">
            <span className="mwi-tooltip__muted">Confidence</span>
            <span>{formatConfidence(hovered.confidence)}</span>
          </div>
        </HoverTooltip>
      ) : null}
    </>
  )
})
