import { latLngBounds } from 'leaflet'
import { ArrowRight, ChevronRight, Image, Layers, MapPin } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { MapContainer, Polygon, TileLayer } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { buttonStyles, Switch } from '@/components/ui'
import type { Detection } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { boundsToLeaflet, geometryBounds, geometryToLeaflet } from '@/lib/geo'
import { BASEMAPS, MAP_COLORS, MAP_MAX_ZOOM } from '@/lib/map/basemaps'

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
        'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control border px-2 py-1.5 text-caption font-medium',
        'transition-colors duration-150 ease-out [&_svg]:size-3.5 [&_svg]:shrink-0',
        active
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border bg-surface text-ink-muted hover:text-ink',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

/**
 * "Trace this detection": a still satellite crop around the detection that can show the raw
 * imagery or the segmentation outline, then the chain from source image to map location.
 */
export function TraceView({
  detection,
  observationId,
  onShowOnMap,
}: {
  detection: Detection
  observationId: string
  onShowOnMap: () => void
}) {
  const [showDetection, setShowDetection] = useState(true)
  const bounds = useMemo(
    () => latLngBounds(boundsToLeaflet(geometryBounds(detection.geometry))).pad(0.6),
    [detection.geometry],
  )
  const positions = useMemo(() => geometryToLeaflet(detection.geometry), [detection.geometry])
  const level = DENSITY_LEVELS[detection.densityLevel]
  const step: TraceStep = showDetection ? 'segmentation' : 'source'

  return (
    <div className="flex flex-col gap-3">
      {/* Decorative still image; the facts it shows are in the drawer as text. */}
      <div aria-hidden className="overflow-hidden rounded-control border border-border">
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
          <TileLayer
            url={BASEMAPS.satellite.url}
            maxNativeZoom={BASEMAPS.satellite.maxNativeZoom}
            maxZoom={MAP_MAX_ZOOM}
          />
          {showDetection ? (
            <Polygon
              positions={positions}
              interactive={false}
              pathOptions={{
                color: MAP_COLORS.halo,
                weight: 1.5,
                fillColor: level.color,
                fillOpacity: 0.6,
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption text-ink-muted">
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
        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-muted" />
        <li className="flex min-w-0 flex-1">
          <Step
            active={step === 'segmentation'}
            icon={<Layers aria-hidden />}
            label="Segmentation"
            onClick={() => setShowDetection(true)}
          />
        </li>
        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-muted" />
        <li className="flex min-w-0 flex-1">
          <Step
            active={false}
            icon={<MapPin aria-hidden />}
            label="Map location"
            onClick={onShowOnMap}
          />
        </li>
      </ol>

      <Link
        to={`/observations/${encodeURIComponent(observationId)}?detection=${encodeURIComponent(detection.id)}`}
        className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'self-start' })}
      >
        View evidence
        <ArrowRight aria-hidden />
      </Link>
    </div>
  )
}
