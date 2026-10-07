import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Banner, ErrorState, Spinner, useToast } from '@/components/ui'
import { MapControls, MapLegend, MapView, type MapHandle } from '@/features/map'
import { DetectionDrawer } from '@/features/map/monitoring/DetectionDrawer'
import { FilterBar } from '@/features/map/monitoring/FilterBar'
import { InspectionPriority } from '@/features/map/monitoring/InspectionPriority'
import { NoDebrisCard } from '@/features/map/monitoring/NoDebrisCard'
import { ResultStrip } from '@/features/map/monitoring/ResultStrip'
import { useMapState } from '@/features/map/useMapState'
import { useCurrentObservationId } from '@/features/observations/currentObservationContext'
import { useObservation, useObservations } from '@/features/observations/hooks'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { analyzeObservation } from '@/lib/analysis'
import { cn } from '@/lib/cn'
import { gridCellSizeForResolution } from '@/lib/config'
import { applyFilters, hasActiveFilters } from '@/lib/filters'
import { formatInteger } from '@/lib/format'
import { serializeMapSearch } from '@/lib/mapUrlState'

/**
 * Map / Monitoring: the full-bleed map with filters, the inspection list and the detail drawer.
 * Everything about the view lives in the URL, so a reload or a shared link restores it.
 */
export function MapPage() {
  useDocumentTitle('Map')
  const { observationId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const mapState = useMapState()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const list = useObservations()
  // Without an id in the path, show the observation picked in the top bar, else the latest.
  const currentId = useCurrentObservationId(list.data?.data)
  const id = observationId ?? currentId ?? undefined
  const query = useObservation(id)
  const observation = query.data?.data
  const issues = query.data?.issues ?? []

  const mapRef = useRef<MapHandle | null>(null)
  const [highlightedHotspotId, setHighlightedHotspotId] = useState<string | null>(null)
  // Captured once: the page was opened straight from the Analyze flow.
  const [arrivedFresh] = useState(() => mapState.fresh)

  const filtered = useMemo(
    () => (observation ? applyFilters(observation, mapState.filters) : null),
    [observation, mapState.filters],
  )
  const analysis = useMemo(
    () => (filtered ? analyzeObservation(filtered.observation) : null),
    [filtered],
  )
  const shownDetections = filtered?.observation.detections ?? []
  const selectedDetection = shownDetections.find((d) => d.id === mapState.detectionId) ?? null
  const selectedHotspot = analysis?.hotspots.find((h) => h.id === mapState.hotspotId) ?? null
  const drawerOpen = Boolean(selectedDetection ?? selectedHotspot)

  // Result arrival: announce once, then drop ?fresh=1 so a reload does not repeat it.
  const announced = useRef(false)
  const { clearFresh, selectHotspot, selectDetection } = mapState
  useEffect(() => {
    if (!arrivedFresh || !observation || announced.current) return
    announced.current = true
    const count = observation.detections.length
    toast.show(
      count === 0
        ? { title: 'No debris detected', description: 'The whole image was checked.' }
        : {
            title: `${formatInteger(count)} ${count === 1 ? 'region' : 'regions'} detected`,
            tone: 'success',
          },
    )
    clearFresh()
  }, [arrivedFresh, observation, toast, clearFresh])

  const onSelectHotspot = useCallback(
    (hotspotId: string | null) => {
      selectHotspot(hotspotId)
      if (hotspotId) mapRef.current?.flyToHotspot(hotspotId)
    },
    [selectHotspot],
  )

  const changeObservation = (nextId: string) => {
    const search = serializeMapSearch({
      ...mapState,
      detectionId: null,
      hotspotId: null,
      fresh: false,
    }).toString()
    navigate(`/map/${encodeURIComponent(nextId)}${search ? `?${search}` : ''}`)
  }

  // A no-debris result has nothing to rank; the card on the map says so.
  const priorityPanel =
    analysis && filtered && filtered.totalCount > 0 ? (
      <InspectionPriority
        hotspots={analysis.hotspots}
        selectedId={selectedHotspot?.id ?? null}
        hasDetections={filtered.shownCount > 0}
        onHighlight={setHighlightedHotspotId}
        onSelect={onSelectHotspot}
        defaultOpen={isDesktop}
        className="pointer-events-auto"
      />
    ) : null

  return (
    <div className="relative isolate h-[calc(100dvh-var(--spacing-topbar))] w-full overflow-hidden">
      <h1 className="sr-only">Map{observation ? `: ${observation.region}` : ''}</h1>

      {observation && filtered && analysis ? (
        <>
          <MapView
            ref={mapRef}
            observation={filtered.observation}
            analysis={analysis}
            visibleLayers={mapState.layers}
            basemap={mapState.basemap}
            selectedDetectionId={selectedDetection?.id ?? null}
            selectedHotspotId={selectedHotspot?.id ?? null}
            highlightedHotspotId={highlightedHotspotId}
            onSelectDetection={selectDetection}
            onSelectHotspot={onSelectHotspot}
            introAnimation={arrivedFresh}
            className="h-full w-full"
            overlay={
              observation.detections.length === 0 ? (
                <NoDebrisCard observation={observation} />
              ) : null
            }
          />

          {/* Top left: filters, result count, notices and, on desktop, the inspection list. */}
          <div
            className={cn(
              'pointer-events-none absolute top-3 left-3 z-[600] flex max-h-[calc(100%-1.5rem)] w-[calc(100%-13.5rem)] flex-col items-start gap-2 md:w-[calc(100%-15rem)]',
              // Leave room for the drawer and the controls that move aside for it.
              drawerOpen && 'md:w-[calc(100%-var(--spacing-drawer)-15rem)]',
            )}
          >
            <div className="pointer-events-auto max-w-full">
              <FilterBar
                observations={list.data?.data ?? []}
                observationId={observation.id}
                onObservationChange={changeObservation}
                filters={mapState.filters}
                onFiltersChange={mapState.setFilters}
                onReset={mapState.resetFilters}
              />
            </div>
            <div className="pointer-events-auto max-w-full">
              <ResultStrip
                shown={filtered.shownCount}
                total={filtered.totalCount}
                hotspots={analysis.hotspots.length}
                matches={filtered.matches}
                filtered={hasActiveFilters(mapState.filters)}
                onReset={mapState.resetFilters}
              />
            </div>
            {observation.crs === null ? (
              <Banner
                tone="warning"
                title="Approximate positions"
                className="pointer-events-auto max-w-sm"
              >
                This image had no coordinate reference system, so it was placed from approximate
                bounds. Positions may be off by a few hundred meters. Areas and counts are measured
                within the image and are still correct.
              </Banner>
            ) : null}
            {issues.length > 0 ? (
              <Banner tone="warning" title="Partial data" className="pointer-events-auto max-w-sm">
                Some detections could not be read and are not shown. The rest of the result is
                complete.
              </Banner>
            ) : null}
            {isDesktop ? priorityPanel : null}
          </div>

          <MapControls
            mapRef={mapRef}
            basemap={mapState.basemap}
            onBasemapChange={mapState.setBasemap}
            visibleLayers={mapState.layers}
            onToggleLayer={mapState.toggleLayer}
            hasDetections={filtered.shownCount > 0}
            className={cn(
              'absolute top-3 right-3 z-[600] transition-[right] duration-200 ease-out',
              drawerOpen && 'md:right-[calc(var(--spacing-drawer)+0.75rem)]',
            )}
          />

          <div className="pointer-events-none absolute bottom-6 left-3 z-[600] flex flex-col items-start gap-2">
            {isDesktop ? null : priorityPanel}
            <MapLegend
              cellSizeM={gridCellSizeForResolution(observation.resolutionM)}
              approximateFootprint={observation.crs === null}
              className="pointer-events-auto"
            />
          </div>

          <DetectionDrawer
            observation={observation}
            detections={shownDetections}
            detection={selectedDetection}
            hotspot={selectedHotspot}
            hotspotCount={analysis.hotspots.length}
            onClose={() => (selectedDetection ? selectDetection(null) : selectHotspot(null))}
            onSelectDetection={(detectionId) => {
              selectDetection(detectionId)
              mapRef.current?.flyToDetection(detectionId)
            }}
            onShowDetectionOnMap={(detectionId) => mapRef.current?.flyToDetection(detectionId)}
          />
        </>
      ) : query.isError || list.isError ? (
        <div className="flex h-full items-center justify-center px-4">
          <ErrorState
            title="The map could not load"
            description="The observation could not be loaded. Check your connection and try again."
            onRetry={() => void (query.isError ? query.refetch() : list.refetch())}
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
