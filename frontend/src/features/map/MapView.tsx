import 'leaflet/dist/leaflet.css'
import './map.css'
import './leafletPatches'
import {
  latLngBounds,
  type FitBoundsOptions,
  type LatLngBoundsExpression,
  type Map as LeafletMap,
} from 'leaflet'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { AttributionControl, MapContainer, useMapEvent } from 'react-leaflet'
import { Banner } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { analyzeObservation, type ObservationAnalysis } from '@/lib/analysis'
import { cn } from '@/lib/cn'
import { boundsOfGeometries, boundsToLeaflet, geometryBounds } from '@/lib/geo'
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, type BasemapId } from '@/lib/map/basemaps'
import type { VisibleLayers } from '@/lib/map/layers'
import { BasemapLayer } from './layers/BasemapLayer'
import { DensityLayer } from './layers/DensityLayer'
import { DetectionsLayer } from './layers/DetectionsLayer'
import { FootprintLayer } from './layers/FootprintLayer'
import { HotspotsLayer } from './layers/HotspotsLayer'
import { ReadoutStrip } from './ReadoutStrip'

export interface MapHandle {
  fitToDetections: () => void
  resetView: () => void
  flyToDetection: (id: string) => void
  flyToHotspot: (id: string) => void
  zoomIn: () => void
  zoomOut: () => void
}

export interface MapViewProps {
  observation: Observation
  visibleLayers: VisibleLayers
  basemap: BasemapId
  selectedDetectionId?: string | null
  selectedHotspotId?: string | null
  onSelectDetection?: (id: string | null) => void
  onSelectHotspot?: (id: string | null) => void
  /** False for small previews: no panning, zooming, hover or selection. */
  interactive?: boolean
  /** Shown over the map, for example the "No debris detected" state. */
  overlay?: ReactNode
  /** Grid and hotspots computed by the page, so both use the same filtered result. */
  analysis?: ObservationAnalysis
  /** Hotspot to emphasise from outside the map (hovering a list row). */
  highlightedHotspotId?: string | null
  /** Detection to emphasise from outside the map (hovering a table row). */
  highlightedDetectionId?: string | null
  /** Zoom with the mouse wheel. Off for maps inside a scrolling page, which use buttons instead. */
  wheelZoom?: boolean
  /**
   * Zoom to a detection once the map is ready, and again whenever a new request arrives.
   * `key` distinguishes repeated requests for the same detection.
   */
  focusRequest?: { detectionId: string; key: number } | null
  /** Run one smooth fit-to-detections animation after the map first loads. */
  introAnimation?: boolean
  /** Space kept around the observation when fitting, in pixels. Small previews use less. */
  fitPadding?: number
  className?: string
  ref?: Ref<MapHandle>
}

/** Fallback view (India) when an observation has neither bounds nor detections. */
const FALLBACK_BOUNDS: LatLngBoundsExpression = [
  [6, 68],
  [24, 92],
]
const DEFAULT_FIT_PADDING = 48
const FOCUS_MAX_ZOOM = 18
/** Hotspots are a few hundred meters across; stop short so the surroundings stay in view. */
const HOTSPOT_MAX_ZOOM = 16

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function ClearSelectionOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvent('click', onClear)
  return null
}

const noop = () => {}

/**
 * The map canvas: basemap, footprint, density grid, detections and hotspots on Leaflet's
 * canvas renderer. Controls and the legend are separate overlays that drive it through the
 * imperative handle.
 */
export function MapView({
  observation,
  visibleLayers,
  basemap,
  selectedDetectionId = null,
  selectedHotspotId = null,
  onSelectDetection = noop,
  onSelectHotspot = noop,
  interactive = true,
  overlay,
  analysis: providedAnalysis,
  highlightedHotspotId = null,
  highlightedDetectionId = null,
  wheelZoom = true,
  focusRequest = null,
  introAnimation = false,
  fitPadding = DEFAULT_FIT_PADDING,
  className,
  ref,
}: MapViewProps) {
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [unavailableBasemap, setUnavailableBasemap] = useState<BasemapId | null>(null)
  const basemapUnavailable = unavailableBasemap === basemap
  const onImagery = basemap === 'satellite' && !basemapUnavailable

  const analysis = useMemo(
    () => providedAnalysis ?? analyzeObservation(observation),
    [providedAnalysis, observation],
  )
  const detectionBounds = useMemo(
    () => boundsOfGeometries(observation.detections.map((d) => d.geometry)),
    [observation.detections],
  )
  const homeBounds = useMemo<LatLngBoundsExpression>(() => {
    const bounds = observation.bounds ?? detectionBounds
    return bounds ? boundsToLeaflet(bounds) : FALLBACK_BOUNDS
  }, [observation.bounds, detectionBounds])

  const animate = interactive && !prefersReducedMotion()
  const FIT_PADDING = useMemo<FitBoundsOptions>(
    () => ({ padding: [fitPadding, fitPadding] }),
    [fitPadding],
  )

  // Result arrival: one fit-to-detections flight once the map is ready.
  const introPlayed = useRef(false)
  useEffect(() => {
    if (!map || !introAnimation || introPlayed.current || !detectionBounds) return
    const timer = window.setTimeout(() => {
      introPlayed.current = true
      const target = boundsToLeaflet(detectionBounds)
      if (animate) map.flyToBounds(target, { ...FIT_PADDING, duration: 1.2 })
      else map.fitBounds(target, FIT_PADDING)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [map, introAnimation, detectionBounds, animate, FIT_PADDING])

  const focusDetection = useCallback(
    (id: string) => {
      const detection = observation.detections.find((d) => d.id === id)
      if (!map || !detection) return
      const target = latLngBounds(boundsToLeaflet(geometryBounds(detection.geometry)))
      const zoom = Math.min(map.getBoundsZoom(target.pad(4)), FOCUS_MAX_ZOOM)
      if (animate) map.flyTo(target.getCenter(), zoom, { duration: 0.6 })
      else map.setView(target.getCenter(), zoom)
    },
    [map, observation.detections, animate],
  )

  const focusDetectionId = focusRequest?.detectionId ?? null
  const focusKey = focusRequest?.key ?? 0
  useEffect(() => {
    if (focusDetectionId) focusDetection(focusDetectionId)
    // focusKey repeats a request for the same detection.
  }, [focusDetection, focusDetectionId, focusKey])

  useImperativeHandle(
    ref,
    () => ({
      fitToDetections: () =>
        map?.fitBounds(detectionBounds ? boundsToLeaflet(detectionBounds) : homeBounds, {
          ...FIT_PADDING,
          animate,
        }),
      resetView: () => map?.fitBounds(homeBounds, { ...FIT_PADDING, animate }),
      flyToDetection: focusDetection,
      flyToHotspot: (id) => {
        const hotspot = analysis.hotspots.find((h) => h.id === id)
        if (!map || !hotspot) return
        const target = latLngBounds(boundsToLeaflet(hotspot.bounds))
        const options = { ...FIT_PADDING, maxZoom: HOTSPOT_MAX_ZOOM }
        if (animate) map.flyToBounds(target, { ...options, duration: 0.6 })
        else map.fitBounds(target, options)
      },
      zoomIn: () => map?.zoomIn(),
      zoomOut: () => map?.zoomOut(),
    }),
    [map, focusDetection, analysis.hotspots, detectionBounds, homeBounds, animate, FIT_PADDING],
  )

  const onMapReady = useCallback(
    (instance: LeafletMap | null) => {
      if (!instance) return
      setMap(instance)
      const container = instance.getContainer()
      container.setAttribute('aria-roledescription', 'map')
      container.setAttribute('aria-label', `Map of ${observation.region}`)
    },
    [observation.region],
  )

  const clearSelection = useCallback(() => {
    onSelectDetection(null)
    onSelectHotspot(null)
  }, [onSelectDetection, onSelectHotspot])

  const onAvailabilityChange = useCallback((id: BasemapId, available: boolean) => {
    setUnavailableBasemap((current) => (available ? (current === id ? null : current) : id))
  }, [])

  return (
    // The basemap state class lives here: react-leaflet applies MapContainer's className only once.
    <div
      className={cn(
        'relative isolate overflow-hidden bg-map-fallback',
        basemapUnavailable && 'mwi-map--no-basemap',
        className,
      )}
    >
      <MapContainer
        // A new observation gets a fresh map fitted to its own bounds.
        key={observation.id}
        ref={onMapReady}
        bounds={homeBounds}
        boundsOptions={FIT_PADDING}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        preferCanvas
        zoomControl={false}
        attributionControl={false}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        scrollWheelZoom={interactive && wheelZoom}
        boxZoom={interactive}
        keyboard={interactive}
        className="mwi-map h-full w-full"
      >
        <AttributionControl position="bottomright" prefix={false} />
        <BasemapLayer key={basemap} basemap={basemap} onAvailabilityChange={onAvailabilityChange} />
        {visibleLayers.footprint && observation.bounds ? (
          <FootprintLayer
            bounds={observation.bounds}
            approximate={observation.crs === null}
            onImagery={onImagery}
          />
        ) : null}
        {visibleLayers.density && analysis.grid ? (
          <DensityLayer grid={analysis.grid} interactive={interactive} onImagery={onImagery} />
        ) : null}
        {visibleLayers.detections ? (
          <DetectionsLayer
            detections={observation.detections}
            selectedId={selectedDetectionId}
            interactive={interactive}
            onImagery={onImagery}
            onSelect={onSelectDetection}
            highlightedId={highlightedDetectionId}
          />
        ) : null}
        {visibleLayers.hotspots ? (
          <HotspotsLayer
            hotspots={analysis.hotspots}
            selectedId={selectedHotspotId}
            highlightedId={highlightedHotspotId}
            interactive={interactive}
            onSelect={onSelectHotspot}
          />
        ) : null}
        {interactive ? <ClearSelectionOnMapClick onClear={clearSelection} /> : null}
      </MapContainer>

      {basemapUnavailable ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
          <Banner tone="info" className="pointer-events-auto py-2 shadow-subtle">
            Basemap unavailable, detections are still shown
          </Banner>
        </div>
      ) : null}

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center p-4">
          <div className="pointer-events-auto">{overlay}</div>
        </div>
      ) : null}

      {interactive && map ? (
        <div className="pointer-events-none absolute right-2 bottom-6 z-[500]">
          <ReadoutStrip map={map} />
        </div>
      ) : null}
    </div>
  )
}
