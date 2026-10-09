import type { Map as LeafletMap } from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorBoundary, PageSkeleton, SkeletonMap, useToast } from '@/components/ui'
import { MapView, type MapHandle } from '@/features/map'
import { LegendLine } from '@/features/map/LegendLine'
import { MapControlGroup } from '@/features/map/MapControlGroup'
import { MapStatusStrip } from '@/features/map/MapStatusStrip'
import { DetectionDrawer } from '@/features/map/monitoring/DetectionDrawer'
import { InspectNextLedger } from '@/features/map/monitoring/InspectNextLedger'
import { LayersPanel } from '@/features/map/monitoring/LayersPanel'
import { MapToolbar } from '@/features/map/monitoring/MapToolbar'
import { NoDebrisCard } from '@/features/map/monitoring/NoDebrisCard'
import { SidePanel } from '@/features/map/monitoring/SidePanel'
import { useMapState } from '@/features/map/useMapState'
import { useCurrentObservationId } from '@/features/observations/currentObservationContext'
import { ObservationNotices } from '@/features/observations/components/ObservationNotices'
import {
  LoadError,
  ObservationNotFound,
  ObservationStatusState,
  StartLink,
} from '@/features/observations/components/ObservationStates'
import type { ExportSource } from '@/features/export/exportFiles'
import { useObservation, useObservations } from '@/features/observations/hooks'
import { hasResult, isNotFound } from '@/features/observations/status'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useShortcuts } from '@/hooks/useShortcuts'
import { analyzeObservation } from '@/lib/analysis'
import { registerCommand } from '@/lib/commandBus'
import { gridCellSizeForResolution } from '@/lib/config'
import { describeFilters } from '@/lib/export/scope'
import { applyFilters, hasActiveFilters } from '@/lib/filters'
import { formatInteger } from '@/lib/format'
import { mapStatusText } from '@/lib/map/status'
import { serializeMapSearch } from '@/lib/mapUrlState'
import { nextStepFor } from '@/lib/navigation'
import { LAYER_SHORTCUTS } from '@/lib/shortcuts'
import type { NoticeId } from '@/lib/warnings'

/** The map has little room: only the caveats about what it draws. */
const MAP_NOTICES: readonly NoticeId[] = [
  'low-confidence',
  'approximate-positions',
  'partial-data',
  'stripe-artefact',
]

/**
 * The page fills the space between the top bar (52px plus its 1px hairline) and the phone tab
 * bar, exactly: nothing below the status strip falls past the viewport.
 */
const PAGE_HEIGHT =
  'h-[calc(100dvh-var(--spacing-topbar)-1px-var(--offline-bar-height,0px)-var(--tabbar-offset))]'

/**
 * Map / Monitoring, as a strict grid (features/map/map.css): the toolbar across the top, the side
 * panel (Inspect next, Layers) on the left, the map, the status strip under it, and the drawer on
 * the right while something is selected. Inside the map there are only two overlays: the control
 * group at the top right and the legend line at the bottom left. Everything about the view lives
 * in the URL, so a reload or a shared link restores it.
 */
export function MapPage() {
  useDocumentTitle('Map')
  const { observationId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const mapState = useMapState()
  const sideDocked = useMediaQuery('(min-width: 1100px)')
  const drawerBeside = useMediaQuery('(min-width: 768px)')
  const [panelOpen, setPanelOpen] = useState(false)
  const [leafletMap, setLeafletMap] = useState<LeafletMap | null>(null)
  const [basemapUnavailable, setBasemapUnavailable] = useState(false)

  const list = useObservations()
  // Without an id in the path, show the observation picked last, else the latest.
  const currentId = useCurrentObservationId(list.data?.data)
  const id = observationId ?? currentId ?? undefined
  const query = useObservation(id)
  const observation = query.data?.data
  const issues = query.data?.issues ?? []

  const mapRef = useRef<MapHandle | null>(null)

  // Keyboard: f fits, l opens the legend details, 1 to 4 toggle the layers (lib/shortcuts.ts).
  const [legendOpen, setLegendOpen] = useState(false)
  const { toggleLayer } = mapState
  useShortcuts(
    useMemo(
      () => ({
        f: () => mapRef.current?.fitToDetections(),
        l: () => setLegendOpen((open) => !open),
        ...Object.fromEntries(
          Object.entries(LAYER_SHORTCUTS).map(([key, layer]) => [key, () => toggleLayer(layer)]),
        ),
      }),
      [toggleLayer],
    ),
  )
  // The command palette's map actions.
  useEffect(() => {
    const removeFit = registerCommand('map.fit', () => mapRef.current?.fitToDetections())
    const removeDensity = registerCommand('map.toggle-density', () => toggleLayer('density'))
    return () => {
      removeFit()
      removeDensity()
    }
  }, [toggleLayer])
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
  const shownDetections = useMemo(() => filtered?.observation.detections ?? [], [filtered])
  // Exports follow the active filters; the summary still describes the whole observation.
  const exportSource = useMemo<ExportSource | null>(
    () =>
      observation && analysis
        ? {
            observation,
            detections: shownDetections,
            analysis,
            filters: describeFilters(mapState.filters),
          }
        : null,
    [observation, analysis, shownDetections, mapState.filters],
  )
  const selectedDetection = shownDetections.find((d) => d.id === mapState.detectionId) ?? null
  const selectedHotspot = analysis?.hotspots.find((h) => h.id === mapState.hotspotId) ?? null

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
      // The slide-over steps aside so the drawer and the map are both in view.
      if (hotspotId && !sideDocked) setPanelOpen(false)
    },
    [selectHotspot, sideDocked],
  )

  const changeObservation = (nextId: string) => {
    const search = serializeMapSearch(
      { ...mapState, detectionId: null, hotspotId: null, fresh: false },
      mapState.defaults,
    ).toString()
    navigate(`/map/${encodeURIComponent(nextId)}${search ? `?${search}` : ''}`)
  }

  let content
  if (observation && !hasResult(observation)) {
    content = (
      <div className="flex h-full items-center justify-center bg-map-fallback px-4">
        <ObservationStatusState observation={observation} className="w-full max-w-lg" />
      </div>
    )
  } else if (observation && filtered && analysis && exportSource) {
    const noDebris = observation.detections.length === 0
    const status = mapStatusText({
      shown: filtered.shownCount,
      total: filtered.totalCount,
      hotspots: analysis.hotspots.length,
      filtered: hasActiveFilters(mapState.filters),
    })
    const cellSizeM = gridCellSizeForResolution(observation.resolutionM)
    const sidePanel = (mode: 'docked' | 'slide-over') => (
      <SidePanel
        mode={mode}
        onClose={() => setPanelOpen(false)}
        next={nextStepFor('map', observation.id)}
        inspect={
          <InspectNextLedger
            hotspots={analysis.hotspots}
            selectedId={selectedHotspot?.id ?? null}
            onHighlight={setHighlightedHotspotId}
            onSelect={onSelectHotspot}
            emptyText={
              noDebris
                ? 'No debris detected, so there is nothing to inspect.'
                : filtered.shownCount > 0
                  ? 'No hotspots in view. The detections shown are scattered or low density.'
                  : 'Nothing to inspect with the current filters.'
            }
          />
        }
        layers={
          <LayersPanel
            visibleLayers={mapState.layers}
            onToggleLayer={toggleLayer}
            counts={{
              detections: filtered.shownCount,
              density: analysis.grid ? analysis.grid.cells.filter((c) => c.level).length : 0,
              hotspots: analysis.hotspots.length,
              footprint: null,
            }}
            basemap={mapState.basemap}
            onBasemapChange={mapState.setBasemap}
            cellSizeM={cellSizeM}
          />
        }
      />
    )

    content = (
      <>
        <div className="mwi-area-toolbar">
          <MapToolbar
            observations={list.data?.data ?? []}
            observation={observation}
            onObservationChange={changeObservation}
            filters={mapState.filters}
            baseline={mapState.baseline}
            onFiltersChange={mapState.setFilters}
            onReset={mapState.resetFilters}
            status={status}
            matches={filtered.matches}
            exportSource={exportSource}
            panel={sideDocked ? null : { open: panelOpen, onToggle: () => setPanelOpen((o) => !o) }}
          />
        </div>
        {sideDocked ? <div className="mwi-area-side">{sidePanel('docked')}</div> : null}
        <div className="mwi-area-notices">
          <ObservationNotices
            observation={observation}
            partialData={issues.length > 0}
            only={MAP_NOTICES}
            size="sm"
            className="border-b border-hairline bg-sheet px-3 py-2"
          />
        </div>
        <div className="mwi-area-map">
          <ErrorBoundary label="The map" resetKeys={[observation.id]} className="h-full w-full">
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
              chrome="bare"
              onMap={setLeafletMap}
              onBasemapUnavailableChange={setBasemapUnavailable}
              className="h-full w-full"
              overlay={noDebris ? <NoDebrisCard observation={observation} /> : null}
              overlays={
                <>
                  <MapControlGroup mapRef={mapRef} hasDetections={filtered.shownCount > 0} />
                  {/* Phones with the drawer open: the map is short, the drawer names the level. */}
                  {noDebris || (!drawerBeside && (selectedDetection ?? selectedHotspot)) ? null : (
                    <LegendLine
                      cellSizeM={cellSizeM}
                      approximateFootprint={observation.crs === null}
                      open={legendOpen}
                      onOpenChange={setLegendOpen}
                    />
                  )}
                </>
              }
            />
          </ErrorBoundary>
        </div>
        <div className="mwi-area-status">
          <MapStatusStrip
            map={leafletMap}
            basemap={mapState.basemap}
            basemapUnavailable={basemapUnavailable}
            status={drawerBeside ? undefined : status}
          />
        </div>
        <div className="mwi-area-drawer">
          <DetectionDrawer
            layout={drawerBeside ? 'side' : 'bottom'}
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
            exportSource={exportSource}
          />
        </div>
        {!sideDocked && panelOpen ? sidePanel('slide-over') : null}
      </>
    )
  } else if (query.isError && isNotFound(query.error)) {
    content = (
      <div className="flex h-full items-center justify-center bg-map-fallback px-4">
        <ObservationNotFound id={id} headingLevel={2} />
      </div>
    )
  } else if (query.isError || list.isError) {
    content = (
      <div className="flex h-full items-center justify-center bg-map-fallback px-4">
        <LoadError
          error={query.isError ? query.error : list.error}
          onRetry={() => void (query.isError ? query.refetch() : list.refetch())}
        />
      </div>
    )
  } else if (list.isSuccess && list.data.data.length === 0 && !observationId) {
    content = (
      <div className="flex h-full items-center justify-center bg-map-fallback px-4">
        <EmptyState
          headingLevel={2}
          title="Nothing to map yet"
          description="Analyze a Sentinel-2 image, and its detections appear here on the map."
          action={<StartLink />}
        />
      </div>
    )
  } else {
    content = (
      <PageSkeleton label="Loading map" className="h-full">
        <SkeletonMap className="h-full w-full" />
      </PageSkeleton>
    )
  }

  const gridded = Boolean(observation && filtered && analysis && hasResult(observation))
  return (
    <div
      className={`relative isolate w-full overflow-hidden ${PAGE_HEIGHT} ${gridded ? 'mwi-map-page' : ''}`}
    >
      <h1 className="sr-only">Map{observation ? `: ${observation.region}` : ''}</h1>
      {content}
    </div>
  )
}
