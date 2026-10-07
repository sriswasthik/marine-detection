import { latLngBounds } from 'leaflet'
import { ArrowRight } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { MapContainer, Rectangle } from 'react-leaflet'
import { BasemapLayer } from '@/features/map/layers/BasemapLayer'
import type { Detection, GeoBounds } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import type { EvidenceSource } from '@/lib/evidence'
import { boundsToLeaflet, metersPerDegreeLat, metersPerDegreeLng } from '@/lib/geo'
import { MAP_COLORS, MAP_MAX_ZOOM } from '@/lib/map/basemaps'
import { getDetectionStyle } from '@/lib/map/detectionStyle'
import { geometryToSvgPath } from '@/lib/svgMask'
import { EvidenceMap } from './EvidenceMap'
import type { EvidenceMode } from './modes'

const MASK_WIDTH = 240

/** The detections drawn as a flat mask on the image footprint, like the model's output raster. */
const MaskThumbnail = memo(function MaskThumbnail({
  bounds,
  detections,
}: {
  bounds: GeoBounds
  detections: readonly Detection[]
}) {
  const height = useMemo(() => {
    const midLat = (bounds.north + bounds.south) / 2
    const widthM = (bounds.east - bounds.west) * metersPerDegreeLng(midLat)
    const heightM = (bounds.north - bounds.south) * metersPerDegreeLat(midLat)
    return widthM > 0 ? Math.max(1, Math.round((MASK_WIDTH * heightM) / widthM)) : MASK_WIDTH
  }, [bounds])
  const paths = useMemo(
    () =>
      detections.map((d) => ({
        id: d.id,
        path: geometryToSvgPath(d.geometry, bounds, MASK_WIDTH, height),
        // The map's own style: low confidence is dashed and lighter here as well.
        style: getDetectionStyle(d, { selected: false, hovered: false }),
      })),
    [detections, bounds, height],
  )
  return (
    <svg
      viewBox={`0 0 ${MASK_WIDTH} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full bg-map-fallback"
    >
      <rect width={MASK_WIDTH} height={height} className="fill-surface" />
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.path}
          fill={p.style.fillColor}
          fillOpacity={Math.min(1, p.style.fillOpacity + 0.3)}
          stroke={p.style.color}
          strokeOpacity={p.style.opacity}
          strokeDasharray={p.style.dashArray}
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
})

/** Where the image sits on Earth: its footprint on a light map with the coast around it. */
const LocationThumbnail = memo(function LocationThumbnail({ bounds }: { bounds: GeoBounds }) {
  const footprint = useMemo(() => boundsToLeaflet(bounds), [bounds])
  const view = useMemo(() => latLngBounds(footprint).pad(2.5), [footprint])
  return (
    <MapContainer
      bounds={view}
      zoomSnap={0}
      maxZoom={MAP_MAX_ZOOM}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      preferCanvas
      fadeAnimation={false}
      className="mwi-map mwi-evidence--still h-full w-full"
    >
      <BasemapLayer basemap="light" onAvailabilityChange={noop} />
      <Rectangle
        bounds={footprint}
        interactive={false}
        pathOptions={{
          color: MAP_COLORS.accent,
          weight: 2,
          fillColor: MAP_COLORS.accent,
          fillOpacity: 0.15,
        }}
      />
    </MapContainer>
  )
})

const noop = () => {}

function Tile({
  active,
  label,
  description,
  thumbnail,
  onClick,
}: {
  active: boolean
  label: string
  description: string
  thumbnail: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'group flex min-w-0 flex-1 flex-col overflow-hidden rounded-control border bg-surface text-left',
        'transition-colors duration-150 ease-out',
        active ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-border-strong',
      )}
    >
      {/* Decorative: the label says what the tile opens. */}
      <span
        aria-hidden
        className="block h-16 w-full overflow-hidden border-b border-border sm:h-20"
      >
        {thumbnail}
      </span>
      <span className="flex flex-col px-2.5 py-2">
        <span className={cn('text-small font-medium', active ? 'text-accent' : 'text-ink')}>
          {label}
        </span>
        <span className="hidden text-caption text-ink-muted sm:block">{description}</span>
      </span>
    </button>
  )
}

/**
 * Image, detection, location: the chain that makes a result traceable. Each tile switches the
 * viewer to that step.
 */
export function TraceabilityStrip({
  source,
  detections,
  mode,
  onModeChange,
}: {
  source: EvidenceSource
  detections: readonly Detection[]
  mode: EvidenceMode
  onModeChange: (mode: EvidenceMode) => void
}) {
  const bounds = source.bounds
  if (!bounds) return null
  const arrow = <ArrowRight aria-hidden className="size-4 shrink-0 self-center text-ink-muted" />
  const item = 'flex min-w-0 flex-1 items-stretch gap-1.5 sm:gap-3'
  return (
    <nav aria-label="Trace from image to location">
      <ol className="flex items-stretch gap-1.5 sm:gap-3">
        <li className={item}>
          <Tile
            active={mode === 'original'}
            label="Source image"
            description="The image as captured"
            onClick={() => onModeChange('original')}
            thumbnail={
              <EvidenceMap
                bounds={bounds}
                previewUrl={source.previewUrl}
                detections={detections}
                showDetections={false}
                look="original"
                attribution={false}
                label="Source image thumbnail"
              />
            }
          />
        </li>
        <li className={item}>
          {arrow}
          <Tile
            active={mode === 'segmentation' || mode === 'compare'}
            label="Segmentation"
            description="What the model found"
            onClick={() => onModeChange('segmentation')}
            thumbnail={<MaskThumbnail bounds={bounds} detections={detections} />}
          />
        </li>
        <li className={item}>
          {arrow}
          <Tile
            active={mode === 'geographic'}
            label="Geographic result"
            description="Where it is on the map"
            onClick={() => onModeChange('geographic')}
            thumbnail={<LocationThumbnail bounds={bounds} />}
          />
        </li>
      </ol>
    </nav>
  )
}
