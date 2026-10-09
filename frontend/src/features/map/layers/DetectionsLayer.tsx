import type { LeafletMouseEvent } from 'leaflet'
import { divIcon, DomEvent, latLngBounds, type Path } from 'leaflet'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Marker, Polygon, useMap, useMapEvent } from 'react-leaflet'
import type { Detection } from '@/features/observations/types'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence } from '@/lib/format'
import { geometryToLeaflet, latLngToTuple } from '@/lib/geo'
import { clusterPoints, type PointCluster, type ScreenPoint } from '@/lib/map/cluster'
import {
  getDetectionStyle,
  getSelectionHaloStyle,
  isLowConfidence,
  type DetectionStyleState,
} from '@/lib/map/detectionStyle'
import {
  detectionRepresentation,
  geometryExtentM,
  type DetectionRepresentation,
} from '@/lib/map/representation'
import { REVEAL_TOTAL_MS, revealFactor, revealStyle } from '@/lib/map/reveal'
import { HoverTooltip } from './HoverTooltip'
import { useFormat } from '@/features/settings/settingsContext'

interface ShapeProps {
  detection: Detection
  state: DetectionStyleState
  interactive: boolean
  /** Draw above everything else on the shared canvas (the selected detection). */
  front?: boolean
  /** 0 to 1 while the one-time fade-in runs; 1 otherwise. */
  reveal?: number
  onEnter: (id: string) => void
  onLeave: (id: string) => void
  onSelect: (id: string) => void
}

/** One detection drawn as its polygon. */
const DetectionShape = memo(function DetectionShape({
  detection,
  state,
  interactive,
  front = false,
  reveal = 1,
  onEnter,
  onLeave,
  onSelect,
}: ShapeProps) {
  const positions = useMemo(() => geometryToLeaflet(detection.geometry), [detection.geometry])
  const style = revealStyle(getDetectionStyle(detection, state), reveal)
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

/** A detection too small to draw: a 6px square in its level colour with a white outline. */
const PointMarker = memo(function PointMarker({
  detection,
  selected,
  interactive,
  onEnter,
  onLeave,
  onSelect,
}: {
  detection: Detection
  selected: boolean
  interactive: boolean
  onEnter: (id: string) => void
  onLeave: (id: string) => void
  onSelect: (id: string) => void
}) {
  const low = isLowConfidence(detection.confidence)
  const icon = useMemo(
    () =>
      divIcon({
        className: `mwi-point${low ? ' is-low' : ''}${selected ? ' is-selected' : ''}`,
        html: `<span style="--level-color:${DENSITY_LEVELS[detection.densityLevel].color}"></span>`,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      }),
    [detection.densityLevel, low, selected],
  )
  const eventHandlers = useMemo(
    () =>
      interactive
        ? {
            mouseover: () => onEnter(detection.id),
            mouseout: () => onLeave(detection.id),
            click: (event: LeafletMouseEvent) => {
              DomEvent.stopPropagation(event)
              onSelect(detection.id)
            },
          }
        : {},
    [interactive, detection.id, onEnter, onLeave, onSelect],
  )
  return (
    <Marker
      position={latLngToTuple(detection.centroid)}
      icon={icon}
      interactive={interactive}
      keyboard={false}
      zIndexOffset={selected ? 900 : 0}
      eventHandlers={eventHandlers}
    />
  )
})

/** Several small detections close together on screen: one counted square; a click zooms in. */
const ClusterMarker = memo(function ClusterMarker({
  cluster,
  position,
  bounds,
}: {
  cluster: PointCluster
  position: [number, number]
  bounds: [[number, number], [number, number]]
}) {
  const map = useMap()
  const icon = useMemo(
    () =>
      divIcon({
        className: 'mwi-cluster',
        // The count's ink per level comes from the theme (index.css --cluster-ink-*).
        html: `<span style="--level-color:${DENSITY_LEVELS[cluster.level].color};--cluster-ink:var(--cluster-ink-${cluster.level})">${cluster.count}</span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    [cluster.level, cluster.count],
  )
  const eventHandlers = useMemo(
    () => ({
      click: (event: LeafletMouseEvent) => {
        DomEvent.stopPropagation(event)
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: map.getZoom() + 3 })
      },
    }),
    [map, bounds],
  )
  return (
    <Marker
      position={position}
      icon={icon}
      title={`${cluster.count} small detections, up to ${DENSITY_LEVELS[cluster.level].label}`}
      keyboard={false}
      zIndexOffset={-1000}
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
  /** Fade the detections in once, staggered (a fresh result). The caller handles reduced motion. */
  reveal?: boolean
}

/** Milliseconds since the reveal started, or null when there is none (or it has finished). */
function useRevealClock(active: boolean): number | null {
  const [elapsed, setElapsed] = useState<number | null>(active ? 0 : null)
  useEffect(() => {
    if (!active) return
    const started = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const time = now - started
      setElapsed(time >= REVEAL_TOTAL_MS ? null : time)
      if (time < REVEAL_TOTAL_MS) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [active])
  return elapsed
}

/**
 * All detections. Polygons share the vector canvas; detections too small to draw become 6px
 * square markers, which merge into counted clusters when more than 40 are in view. Only the
 * hovered and selected shapes re-render on interaction.
 */
export const DetectionsLayer = memo(function DetectionsLayer({
  detections,
  selectedId,
  interactive,
  onImagery,
  onSelect,
  highlightedId = null,
  reveal = false,
}: DetectionsLayerProps) {
  const fmt = useFormat()
  const revealElapsed = useRevealClock(reveal)
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  // Bumped after every pan or zoom, so the visible markers are clustered again.
  const [viewTick, setViewTick] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  useMapEvent('zoomend', () => setZoom(map.getZoom()))
  useMapEvent('moveend', () => setViewTick((tick) => tick + 1))

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

  const modeOf = useCallback(
    (d: Detection): DetectionRepresentation =>
      detectionRepresentation(extents.get(d.id) ?? 0, d.centroid.lat, zoom),
    [extents, zoom],
  )
  const hovered = interactive ? detections.find((d) => d.id === hoveredId) : undefined
  const emphasisedId = hoveredId ?? highlightedId
  const selected = detections.find((d) => d.id === selectedId)

  // Small detections in view, clustered on screen. The selected one is always drawn on its own.
  const points = useMemo(() => {
    void viewTick // re-run after the view moves
    const view = map.getBounds().pad(0.1)
    const screen: ScreenPoint[] = []
    for (const d of detections) {
      if (d.id === selectedId || modeOf(d) !== 'point') continue
      const position = latLngToTuple(d.centroid)
      if (!view.contains(position)) continue
      const { x, y } = map.latLngToContainerPoint(position)
      screen.push({ id: d.id, x, y, level: d.densityLevel })
    }
    return clusterPoints(screen)
  }, [detections, selectedId, modeOf, map, viewTick])
  const byId = useMemo(() => new Map(detections.map((d) => [d.id, d])), [detections])

  return (
    <>
      {detections.map((detection, index) =>
        detection.id === selectedId || modeOf(detection) === 'point' ? null : (
          <DetectionShape
            key={detection.id}
            detection={detection}
            reveal={
              revealElapsed === null ? 1 : revealFactor(index, detections.length, revealElapsed)
            }
            state={detection.id === emphasisedId ? hoveredState : idle}
            interactive={interactive}
            onEnter={onEnter}
            onLeave={onLeave}
            onSelect={onSelect}
          />
        ),
      )}
      {points.singles.map((point) => {
        const detection = byId.get(point.id)
        return detection ? (
          <PointMarker
            key={point.id}
            detection={detection}
            selected={false}
            interactive={interactive}
            onEnter={onEnter}
            onLeave={onLeave}
            onSelect={onSelect}
          />
        ) : null
      })}
      {points.clusters.map((cluster) => {
        const members = cluster.ids.flatMap((id) => {
          const d = byId.get(id)
          return d ? [latLngToTuple(d.centroid)] : []
        })
        const box = latLngBounds(members)
        return (
          <ClusterMarker
            key={cluster.id}
            cluster={cluster}
            position={latLngToTuple(map.containerPointToLatLng([cluster.x, cluster.y]))}
            bounds={[
              [box.getSouth(), box.getWest()],
              [box.getNorth(), box.getEast()],
            ]}
          />
        )
      })}
      {selected ? (
        modeOf(selected) === 'polygon' ? (
          <>
            <Polygon
              positions={geometryToLeaflet(selected.geometry)}
              pathOptions={getSelectionHaloStyle()}
              interactive={false}
              eventHandlers={BRING_TO_FRONT}
            />
            <DetectionShape
              key={`selected-${selected.id}`}
              detection={selected}
              state={{ selected: true, hovered: selected.id === emphasisedId, onImagery }}
              interactive={interactive}
              front
              onEnter={onEnter}
              onLeave={onLeave}
              onSelect={onSelect}
            />
          </>
        ) : (
          <PointMarker
            key={`selected-${selected.id}`}
            detection={selected}
            selected
            interactive={interactive}
            onEnter={onEnter}
            onLeave={onLeave}
            onSelect={onSelect}
          />
        )
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
