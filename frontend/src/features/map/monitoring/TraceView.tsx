import { latLngBounds } from 'leaflet'
import { ChevronRight, Image, Layers, MapPin } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { MapContainer, Polygon } from 'react-leaflet'
import { BasemapLayer } from '@/features/map/layers/BasemapLayer'
import { Switch } from '@/components/ui'
import type { Detection } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { boundsToLeaflet, geometryBounds, geometryToLeaflet } from '@/lib/geo'
import { BASEMAPS, MAP_MAX_ZOOM } from '@/lib/map/basemaps'
import { getDetectionStyle } from '@/lib/map/detectionStyle'

type TraceStep = 'source' | 'segmentation' | 'map'

function Step({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-w-0 flex-1 items-center justify-center gap-2 border px-2 py-2 text-small font-medium',
        'transition-colors duration-[120ms] ease-out [&_svg]:size-4 [&_svg]:shrink-0',
        active
          ? 'border-accent-ink bg-accent-wash text-accent-ink'
          : 'border-hairline text-ink-2 hover:text-ink',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

/**
 * "Trace this detection": a still satellite crop around the detection that can show the raw
 * imagery or the segmentation outline, then the chain from source image to map location. The
 * drawer's "View evidence" continues the trace on the detail page.
 */
export function TraceView({
  detection,
  onShowOnMap,
}: {
  detection: Detection
  onShowOnMap: () => void
}) {
  const [showDetection, setShowDetection] = useState(true)
  const [imageryUnavailable, setImageryUnavailable] = useState(false)
  const bounds = useMemo(
    () => latLngBounds(boundsToLeaflet(geometryBounds(detection.geometry))).pad(0.6),
    [detection.geometry],
  )
  const positions = useMemo(() => geometryToLeaflet(detection.geometry), [detection.geometry])
  const step: TraceStep = showDetection ? 'segmentation' : 'source'

  return (
    <div className="flex flex-col gap-3">
      {/* Decorative still image; the facts it shows are in the drawer as text. */}
      <div
        aria-hidden
        className="relative isolate overflow-hidden rounded-control border border-hairline bg-map-fallback"
      >
        <MapContainer
          key={detection.id}
          bounds={bounds}
          maxZoom={MAP_MAX_ZOOM}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
          keyboard={false}
          preferCanvas
          className="mwi-map h-40 w-full"
        >
          <BasemapLayer
            basemap="satellite"
            onAvailabilityChange={(_, available) => setImageryUnavailable(!available)}
          />
          {showDetection ? (
            <Polygon
              positions={positions}
              interactive={false}
              // Same style as on the map, so low confidence stays dashed and lighter here too.
              pathOptions={getDetectionStyle(detection, {
                selected: false,
                hovered: false,
                onImagery: true,
              })}
            />
          ) : null}
        </MapContainer>
        {imageryUnavailable ? (
          <p className="pointer-events-none absolute inset-x-2 bottom-2 z-[500] border border-hairline bg-sheet px-2 py-1 text-small text-ink-2">
            Satellite imagery unavailable; the outline is still drawn
          </p>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-small text-ink-2">
          Esri World Imagery at this location ({BASEMAPS.satellite.attribution}). The source image
          itself is in the evidence view.
        </p>
        <Switch
          label="Show detection"
          checked={showDetection}
          onCheckedChange={setShowDetection}
          labelPosition="start"
          className="shrink-0 whitespace-nowrap"
        />
      </div>

      <ol className="flex items-center gap-1" aria-label="Trace from source to map">
        <li className="flex min-w-0 flex-1">
          <Step
            active={step === 'source'}
            icon={<Image aria-hidden />}
            label="Source image"
            onClick={() => setShowDetection(false)}
          />
        </li>
        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-2" />
        <li className="flex min-w-0 flex-1">
          <Step
            active={step === 'segmentation'}
            icon={<Layers aria-hidden />}
            label="Segmentation"
            onClick={() => setShowDetection(true)}
          />
        </li>
        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-2" />
        <li className="flex min-w-0 flex-1">
          <Step
            active={false}
            icon={<MapPin aria-hidden />}
            label="Map location"
            onClick={onShowOnMap}
          />
        </li>
      </ol>
    </div>
  )
}
