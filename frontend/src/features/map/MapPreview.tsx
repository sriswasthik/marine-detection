import type { ReactNode } from 'react'
import type { Observation } from '@/features/observations/types'
import type { ObservationAnalysis } from '@/lib/analysis'
import { cn } from '@/lib/cn'
import { DEFAULT_BASEMAP, type BasemapId } from '@/lib/map/basemaps'
import { PREVIEW_VISIBLE_LAYERS, type VisibleLayers } from '@/lib/map/layers'
import { MapView } from './MapView'

/**
 * Small, non-interactive map fitted to the observation: detections and hotspots by default,
 * no controls. For the overview and detail pages.
 */
export function MapPreview({
  observation,
  analysis,
  basemap = DEFAULT_BASEMAP,
  visibleLayers = PREVIEW_VISIBLE_LAYERS,
  overlay,
  onBasemapLoad,
  className,
}: {
  observation: Observation
  /** Reuse an analysis the page already computed. */
  analysis?: ObservationAnalysis
  basemap?: BasemapId
  visibleLayers?: VisibleLayers
  overlay?: ReactNode
  /** Called when the basemap tiles in view have finished loading. */
  onBasemapLoad?: () => void
  className?: string
}) {
  return (
    <MapView
      observation={observation}
      analysis={analysis}
      visibleLayers={visibleLayers}
      basemap={basemap}
      interactive={false}
      fitPadding={16}
      overlay={overlay}
      onBasemapLoad={onBasemapLoad}
      className={cn('rounded-card border border-border', className)}
    />
  )
}
