import { Inbox, ScanSearch } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  buttonStyles,
  EmptyState,
  ErrorBoundary,
  PageSkeleton,
  SkeletonMap,
  useToast,
} from '@/components/ui'
import { MapControls, MapLegend, MapView, type MapHandle } from '@/features/map'
import { DetectionDrawer } from '@/features/map/monitoring/DetectionDrawer'
import { FilterBar } from '@/features/map/monitoring/FilterBar'
import { InspectionPriority } from '@/features/map/monitoring/InspectionPriority'
import { NoDebrisCard } from '@/features/map/monitoring/NoDebrisCard'
import { ResultStrip } from '@/features/map/monitoring/ResultStrip'
import { useMapState } from '@/features/map/useMapState'
import { useCurrentObservationId } from '@/features/observations/currentObservationContext'
import { ObservationNotices } from '@/features/observations/components/ObservationNotices'
import {
  LoadError,
  ObservationNotFound,
  ObservationStatusState,
} from '@/features/observations/components/ObservationStates'
import type { ExportSource } from '@/features/export/exportFiles'
import { ExportMenu } from '@/features/export/ExportMenu'
import { useObservation, useObservations } from '@/features/observations/hooks'
import { hasResult, isNotFound } from '@/features/observations/status'
import type { Observation } from '@/features/observations/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { analyzeObservation, type ObservationAnalysis } from '@/lib/analysis'
import { cn } from '@/lib/cn'
import { gridCellSizeForResolution } from '@/lib/config'
import { applyFilters, hasActiveFilters } from '@/lib/filters'
import { formatInteger } from '@/lib/format'
import { describeFilters } from '@/lib/export/scope'
import { serializeMapSearch } from '@/lib/mapUrlState'
import type { NoticeId } from '@/lib/warnings'

/** The map has little room: only the caveats about what it draws. */
const MAP_NOTICES: readonly NoticeId[] = ['low-confidence', 'approximate-positions', 'partial-data']

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
  // Exports follow the active filters; the summary still describes the whole observation.
  const filterDescription = describeFilters(mapState.filters)
  const exportSource = (full: Observation, shownAnalysis: ObservationAnalysis): ExportSource => ({
    observation: full,
    detections: shownDetections,
    analysis: shownAnalysis,
    filters: filterDescription,
  })
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
    const search = serializeMapSearch(
      {
        ...mapState,
        detectionId: null,
        hotspotId: null,
        fresh: false,
      },
      mapState.defaults,
    ).toString()
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
    <div className="relative isolate h-[calc(100dvh-var(--spacing-topbar)-var(--offline-bar-height,0px))] w-full overflow-hidden">
      <h1 className="sr-only">Map{observation ? `: ${observation.region}` : ''}</h1>

      {observation && !hasResult(observation) ? (
        <div className="flex h-full items-center justify-center bg-map-fallback px-4">
          <ObservationStatusState observation={observation} className="w-full max-w-lg" />
        </div>
      ) : observation && filtered && analysis ? (
        <>
          <ErrorBoundary
            label="The map"
            resetKeys={[observation.id]}
            className="h-full w-full rounded-none border-0"
          >
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
          </ErrorBoundary>

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
                baseline={mapState.baseline}
              />
            </div>
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2">
              <ResultStrip
                shown={filtered.shownCount}
                total={filtered.totalCount}
                hotspots={analysis.hotspots.length}
                matches={filtered.matches}
                filtered={hasActiveFilters(mapState.filters)}
                onReset={mapState.resetFilters}
              />
              <ExportMenu source={exportSource(observation, analysis)} align="start" size="sm" />
            </div>
            <ObservationNotices
              observation={observation}
              partialData={issues.length > 0}
              only={MAP_NOTICES}
              className="w-full max-w-sm"
              bannerClassName="pointer-events-auto shadow-subtle"
            />
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
            exportSource={exportSource(observation, analysis)}
          />
        </>
      ) : query.isError && isNotFound(query.error) ? (
        <div className="flex h-full items-center justify-center bg-map-fallback px-4">
          <ObservationNotFound id={id} headingLevel={2} />
        </div>
      ) : query.isError || list.isError ? (
        <div className="flex h-full items-center justify-center bg-map-fallback px-4">
          <LoadError
            error={query.isError ? query.error : list.error}
            onRetry={() => void (query.isError ? query.refetch() : list.refetch())}
          />
        </div>
      ) : list.isSuccess && list.data.data.length === 0 && !observationId ? (
        <div className="flex h-full items-center justify-center bg-map-fallback px-4">
          <EmptyState
            icon={<Inbox />}
            headingLevel={2}
            title="Nothing to map yet"
            description="Analyze a satellite or drone image, and its detections appear here on the map."
            action={
              <Link to="/analyze" className={buttonStyles({ variant: 'primary' })}>
                <ScanSearch aria-hidden />
                Analyze new imagery
              </Link>
            }
          />
        </div>
      ) : (
        <PageSkeleton label="Loading map" className="h-full">
          <SkeletonMap className="h-full w-full" />
        </PageSkeleton>
      )}
    </div>
  )
}
