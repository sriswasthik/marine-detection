import type { Observation } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DEFAULT_BASEMAP, type BasemapId } from '@/lib/map/basemaps'
import { PREVIEW_VISIBLE_LAYERS } from '@/lib/map/layers'
import { MapView } from './MapView'

/**
 * Small, non-interactive map fitted to the observation: detections and hotspots only,
 * no controls. For the overview and detail pages.
 */
export function MapPreview({
  observation,
  basemap = DEFAULT_BASEMAP,
  className,
}: {
  observation: Observation
  basemap?: BasemapId
  className?: string
}) {
  return (
    <MapView
      observation={observation}
      visibleLayers={PREVIEW_VISIBLE_LAYERS}
      basemap={basemap}
      interactive={false}
      className={cn('rounded-card border border-border', className)}
    />
  )
}
