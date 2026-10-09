import 'leaflet/dist/leaflet.css'
import '@/features/map/map.css'
import '@/features/map/leafletPatches'
import type { Map as LeafletMap } from 'leaflet'
import { useCallback, useMemo, useState } from 'react'
import { AttributionControl, ImageOverlay, MapContainer, Pane, ZoomControl } from 'react-leaflet'
import { Checkbox, SectionLabel, SegmentedControl } from '@/components/ui'
import { BasemapLayer } from '@/features/map/layers/BasemapLayer'
import { DetectionsLayer } from '@/features/map/layers/DetectionsLayer'
import type { Detection, GeoBounds } from '@/features/observations/types'
import { boundsToLeaflet } from '@/lib/geo'
import { BASEMAPS, MAP_MAX_ZOOM, MAP_MIN_ZOOM, type BasemapId } from '@/lib/map/basemaps'

/** The two basemaps of the report map: street map and satellite imagery. */
const REPORT_BASEMAPS = ['osm', 'satellite'] as const satisfies readonly BasemapId[]
type ReportBasemap = (typeof REPORT_BASEMAPS)[number]

const noop = () => {}

/**
 * Interactive satellite and AI detection map: OpenStreetMap or satellite imagery underneath, and
 * two layers to switch on and off, the uploaded image (warped to the map over its bounds) and the
 * model's debris detections.
 */
export function ResultMapSection({
  bounds,
  imageUrl,
  detections,
  name,
}: {
  bounds: GeoBounds | null
  /** The uploaded image, georeferenced over `bounds`. */
  imageUrl: string | null
  detections: readonly Detection[]
  name: string
}) {
  const [basemap, setBasemap] = useState<ReportBasemap>('osm')
  const [showImage, setShowImage] = useState(true)
  const [showDetections, setShowDetections] = useState(true)
  const [basemapUnavailable, setBasemapUnavailable] = useState(false)
  const leafletBounds = useMemo(() => (bounds ? boundsToLeaflet(bounds) : null), [bounds])
  const onMapReady = useCallback(
    (instance: LeafletMap | null) => {
      instance?.getContainer().setAttribute('aria-label', `Map of ${name}`)
    },
    [name],
  )
  const onAvailabilityChange = useCallback(
    (_: BasemapId, available: boolean) => setBasemapUnavailable(!available),
    [],
  )

  return (
    <section aria-labelledby="result-map-title" className="flex flex-col gap-4">
      <SectionLabel id="result-map-title">Interactive satellite and AI detection map</SectionLabel>
      {leafletBounds ? (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <SegmentedControl
              label="Basemap"
              size="sm"
              options={REPORT_BASEMAPS.map((id) => ({ value: id, label: BASEMAPS[id].label }))}
              value={basemap}
              onChange={(next) => {
                setBasemapUnavailable(false)
                setBasemap(next)
              }}
            />
            <Checkbox
              size="sm"
              label="Uploaded satellite image"
              checked={showImage && imageUrl !== null}
              disabled={imageUrl === null}
              onChange={(event) => setShowImage(event.target.checked)}
            />
            <Checkbox
              size="sm"
              label={`AI marine debris detection (${detections.length})`}
              checked={showDetections}
              onChange={(event) => setShowDetections(event.target.checked)}
            />
          </div>
          <div className="relative isolate h-[28rem] overflow-hidden border border-rule bg-map-fallback max-sm:h-80">
            <MapContainer
              ref={onMapReady}
              bounds={leafletBounds}
              boundsOptions={{ padding: [24, 24] }}
              minZoom={MAP_MIN_ZOOM}
              maxZoom={MAP_MAX_ZOOM}
              zoomSnap={0.25}
              preferCanvas
              zoomControl={false}
              attributionControl={false}
              scrollWheelZoom={false}
              className="mwi-map h-full w-full"
            >
              <ZoomControl position="topleft" />
              <AttributionControl position="bottomright" prefix={false} />
              <BasemapLayer
                key={basemap}
                basemap={basemap}
                onAvailabilityChange={onAvailabilityChange}
              />
              {showImage && imageUrl ? (
                <Pane name="report-image" style={{ zIndex: 250 }}>
                  <ImageOverlay url={imageUrl} bounds={leafletBounds} />
                </Pane>
              ) : null}
              {showDetections ? (
                <DetectionsLayer
                  detections={detections}
                  selectedId={null}
                  interactive={false}
                  onImagery={basemap === 'satellite' || showImage}
                  onSelect={noop}
                />
              ) : null}
            </MapContainer>
            {basemapUnavailable ? (
              <p className="pointer-events-none absolute bottom-2 left-2 z-[500] border border-hairline bg-sheet px-2 py-1 text-small text-ink-2">
                Basemap unavailable, the image and detections are still shown
              </p>
            ) : null}
          </div>
          <p className="text-small text-ink-2">
            Drag to pan, use the buttons to zoom. Detections are the model&apos;s Marine Debris
            regions, outlined on the pixels it classed as debris.
          </p>
        </>
      ) : (
        <p className="text-small text-ink-2">
          This image has no usable georeferencing, so it cannot be placed on a map.
        </p>
      )}
    </section>
  )
}
