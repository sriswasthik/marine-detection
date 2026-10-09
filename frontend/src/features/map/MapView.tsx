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
  useEffectEvent,
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
import { boundsOfGeometries, boundsToLeaflet, geometryBounds, latLngToTuple } from '@/lib/geo'
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, type BasemapId } from '@/lib/map/basemaps'
import type { VisibleLayers } from '@/lib/map/layers'
import { NOTHING_OCCLUDED, visiblePadding, type OccludedEdges } from '@/lib/map/occlusion'
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
  /** Shown centred over the map, for example the "No debris detected" state. */
  overlay?: ReactNode
  /**
   * Positioned overlays drawn inside the map frame (the Map page's control group and legend line).
   * The caller places them; they sit above the map and its centred overlay.
   */
  overlays?: ReactNode
  /**
   * `full` draws Leaflet's attribution and the scale and coordinate readout inside the map.
   * `bare` leaves them out: the Map page shows both in its status strip below the map.
   */
  chrome?: 'full' | 'bare'
  /** The Leaflet map once it exists, for chrome outside the map (the status strip). */
  onMap?: (map: LeafletMap) => void
  /** Whether the chosen basemap failed to load (shown in the status strip in `bare` mode). */
  onBasemapUnavailableChange?: (unavailable: boolean) => void
  /** Grid and hotspots computed by the page, so both use the same filtered result. */
  analysis?: ObservationAnalysis
  /** Hotspot to emphasise from outside the map (hovering a list row). */
  highlightedHotspotId?: string | null
  /** Detection to emphasise from outside the map (hovering a table row). */
  highlightedDetectionId?: string | null
  /** Called each time every basemap tile in view has finished loading (or failed). */
  onBasemapLoad?: () => void
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
  /**
   * Pixels of the map the detail drawer hides while something is selected. Flights to a
   * detection or hotspot, and selections, keep the target in the visible part (see
   * lib/map/occlusion.ts). Flights always accompany a selection, so they use it even when called
   * in the same event that opens the drawer.
   */
  drawerOcclusion?: OccludedEdges
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
  overlays,
  chrome = 'full',
  onMap,
  onBasemapUnavailableChange,
  analysis: providedAnalysis,
  highlightedHotspotId = null,
  highlightedDetectionId = null,
  wheelZoom = true,
  onBasemapLoad,
  focusRequest = null,
  introAnimation = false,
  fitPadding = DEFAULT_FIT_PADDING,
  drawerOcclusion = NOTHING_OCCLUDED,
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
  // Like FIT_PADDING, but clear of what the drawer covers while something is selected.
  const VISIBLE_PADDING = useMemo<FitBoundsOptions>(
    () => visiblePadding(fitPadding, drawerOcclusion),
    [fitPadding, drawerOcclusion],
  )
  const selectedId = selectedHotspotId ?? selectedDetectionId
  const viewPadding = selectedId ? VISIBLE_PADDING : FIT_PADDING
  /** The target of the last fly, so the "keep the selection visible" pan does not cut it short. */
  const flownTo = useRef<string | null>(null)

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
      flownTo.current = id
      const target = latLngBounds(boundsToLeaflet(geometryBounds(detection.geometry))).pad(4)
      const options = { ...VISIBLE_PADDING, maxZoom: FOCUS_MAX_ZOOM }
      if (animate) map.flyToBounds(target, { ...options, duration: 0.6 })
      else map.fitBounds(target, options)
    },
    [map, observation.detections, animate, VISIBLE_PADDING],
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
          ...viewPadding,
          animate,
        }),
      resetView: () => map?.fitBounds(homeBounds, { ...viewPadding, animate }),
      flyToDetection: focusDetection,
      flyToHotspot: (id) => {
        const hotspot = analysis.hotspots.find((h) => h.id === id)
        if (!map || !hotspot) return
        flownTo.current = id
        const target = latLngBounds(boundsToLeaflet(hotspot.bounds))
        const options = { ...VISIBLE_PADDING, maxZoom: HOTSPOT_MAX_ZOOM }
        if (animate) map.flyToBounds(target, { ...options, duration: 0.6 })
        else map.fitBounds(target, options)
      },
      zoomIn: () => map?.zoomIn(),
      zoomOut: () => map?.zoomOut(),
    }),
    [
      map,
      focusDetection,
      analysis.hotspots,
      detectionBounds,
      homeBounds,
      animate,
      VISIBLE_PADDING,
      viewPadding,
    ],
  )

  // A selection made on the map (or from the URL) stays in view when the drawer opens over it.
  const selectedPoint = useMemo(() => {
    if (selectedHotspotId) {
      return analysis.hotspots.find((h) => h.id === selectedHotspotId)?.centroid ?? null
    }
    if (selectedDetectionId) {
      return observation.detections.find((d) => d.id === selectedDetectionId)?.centroid ?? null
    }
    return null
  }, [selectedHotspotId, selectedDetectionId, analysis.hotspots, observation.detections])
  useEffect(() => {
    if (!selectedId) flownTo.current = null
    if (!map || !interactive || !selectedId || !selectedPoint) return
    if (flownTo.current === selectedId) return // a flight is already bringing it into view
    map.panInside(latLngToTuple(selectedPoint), { ...VISIBLE_PADDING, animate })
  }, [map, interactive, selectedId, selectedPoint, VISIBLE_PADDING, animate])

  const onMapReady = useCallback(
    (instance: LeafletMap | null) => {
      if (!instance) return
      setMap(instance)
      onMap?.(instance)
      const container = instance.getContainer()
      container.setAttribute('aria-roledescription', 'map')
      container.setAttribute('aria-label', `Map of ${observation.region}`)
    },
    [observation.region, onMap],
  )

  // Docked panels open and close beside the map: keep Leaflet's size in step with the frame.
  // Until the person moves the map or selects something, a resize also refits the scene, so a
  // map that mounted before its grid cell reached full size still frames the whole image.
  const frameRef = useRef<HTMLDivElement | null>(null)
  const touched = useRef(false)
  const onFrameResize = useEffectEvent((instance: LeafletMap) => {
    instance.invalidateSize({ pan: false })
    if (!touched.current && !selectedId)
      instance.fitBounds(homeBounds, { ...FIT_PADDING, animate: false })
  })
  useEffect(() => {
    const frame = frameRef.current
    if (!map || !frame || typeof ResizeObserver === 'undefined') return
    const markTouched = () => {
      touched.current = true
    }
    const container = map.getContainer()
    for (const type of ['pointerdown', 'wheel', 'keydown'] as const)
      container.addEventListener(type, markTouched, { passive: true })
    const observer = new ResizeObserver(() => onFrameResize(map))
    observer.observe(frame)
    return () => {
      observer.disconnect()
      for (const type of ['pointerdown', 'wheel', 'keydown'] as const)
        container.removeEventListener(type, markTouched)
    }
  }, [map])

  useEffect(() => {
    onBasemapUnavailableChange?.(basemapUnavailable)
  }, [basemapUnavailable, onBasemapUnavailableChange])

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
      ref={frameRef}
      data-map-canvas=""
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
        // Quarter steps: a fit fills the frame instead of dropping a whole zoom level (half size).
        zoomSnap={0.25}
        zoomDelta={0.5}
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
        {chrome === 'full' ? <AttributionControl position="bottomright" prefix={false} /> : null}
        <BasemapLayer
          key={basemap}
          basemap={basemap}
          onAvailabilityChange={onAvailabilityChange}
          onLoad={onBasemapLoad}
        />
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
            // A fresh result fades in once; `animate` is off for reduced motion and previews.
            reveal={introAnimation && animate}
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

      {basemapUnavailable && chrome === 'full' ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
          <Banner tone="info" className="pointer-events-auto py-2">
            Basemap unavailable, detections are still shown
          </Banner>
        </div>
      ) : null}

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center p-4">
          <div className="pointer-events-auto">{overlay}</div>
        </div>
      ) : null}

      {interactive && map && chrome === 'full' ? (
        <div className="pointer-events-none absolute right-2 bottom-6 z-[500]">
          <ReadoutStrip map={map} />
        </div>
      ) : null}

      {overlays}
    </div>
  )
}
