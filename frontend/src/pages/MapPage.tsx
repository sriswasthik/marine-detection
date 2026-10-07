import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Banner, ErrorState, Spinner } from '@/components/ui'
import { MapControls, MapLegend, MapView, useMapLayers, type MapHandle } from '@/features/map'
import { useObservation, useObservations } from '@/features/observations/hooks'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { gridCellSizeForResolution } from '@/lib/config'
import { DEFAULT_BASEMAP, type BasemapId } from '@/lib/map/basemaps'

/**
 * Temporary wiring for review: the full-bleed map for one observation. The final page layout
 * (side panel, detection list) comes in the next task.
 */
export function MapPage() {
  useDocumentTitle('Map')
  const { observationId } = useParams()
  const list = useObservations()
  // Without an id, show the most recent observation (the Ennore sample in mock mode).
  const id = observationId ?? list.data?.data[0]?.id
  const query = useObservation(id)

  const mapRef = useRef<MapHandle | null>(null)
  const [basemap, setBasemap] = useState<BasemapId>(DEFAULT_BASEMAP)
  const { visibleLayers, toggleLayer } = useMapLayers()
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null)
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)

  const observation = query.data?.data
  const issues = query.data?.issues ?? []

  return (
    <div className="relative h-[calc(100dvh-var(--spacing-topbar))] w-full">
      <h1 className="sr-only">Map{observation ? `: ${observation.region}` : ''}</h1>

      {observation ? (
        <>
          <MapView
            ref={mapRef}
            observation={observation}
            visibleLayers={visibleLayers}
            basemap={basemap}
            selectedDetectionId={selectedDetectionId}
            selectedHotspotId={selectedHotspotId}
            onSelectDetection={(detectionId) => {
              setSelectedDetectionId(detectionId)
              if (detectionId) setSelectedHotspotId(null)
            }}
            onSelectHotspot={(hotspotId) => {
              setSelectedHotspotId(hotspotId)
              if (hotspotId) {
                setSelectedDetectionId(null)
                mapRef.current?.flyToHotspot(hotspotId)
              }
            }}
            className="h-full w-full"
            overlay={
              observation.detections.length === 0 ? (
                <div className="max-w-xs rounded-card border border-border bg-surface px-4 py-3 text-center shadow-subtle">
                  <p className="text-heading text-ink">No debris detected</p>
                  <p className="mt-1 text-small text-ink-muted">
                    The model found no floating debris in this image. The footprint shows the area
                    that was checked.
                  </p>
                </div>
              ) : null
            }
          />
          <MapControls
            mapRef={mapRef}
            basemap={basemap}
            onBasemapChange={setBasemap}
            visibleLayers={visibleLayers}
            onToggleLayer={toggleLayer}
            hasDetections={observation.detections.length > 0}
            className="absolute top-3 right-3 z-[600]"
          />
          <MapLegend
            cellSizeM={gridCellSizeForResolution(observation.resolutionM)}
            approximateFootprint={observation.crs === null}
            className="absolute bottom-6 left-3 z-[600]"
          />
          {issues.length > 0 ? (
            <div className="absolute top-3 left-3 z-[600] max-w-sm">
              <Banner tone="warning" title="Partial data">
                Some detections could not be read and are not shown.
              </Banner>
            </div>
          ) : null}
        </>
      ) : query.isError || list.isError ? (
        <div className="flex h-full items-center justify-center px-4">
          <ErrorState
            title="The map could not load"
            description="The observation could not be loaded. Check your connection and try again."
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center bg-map-fallback text-ink-muted">
          <Spinner label="Loading map" />
        </div>
      )}
    </div>
  )
}
