import { memo, useRef } from 'react'
import { TileLayer } from 'react-leaflet'
import { BASEMAPS, MAP_MAX_ZOOM, type BasemapId } from '@/lib/map/basemaps'
import {
  INITIAL_TILE_FAILURE_STATE,
  tileFailureReducer,
  type TileEvent,
} from '@/lib/map/tileFailures'

interface BasemapLayerProps {
  basemap: BasemapId
  /** Called when availability changes, not on every tile. */
  onAvailabilityChange: (basemap: BasemapId, available: boolean) => void
}

/**
 * Tile layer that reports when the basemap stops loading, so the map can fall back quietly.
 * Mount it with key={basemap} so each basemap starts with a fresh failure count.
 */
export const BasemapLayer = memo(function BasemapLayer({
  basemap,
  onAvailabilityChange,
}: BasemapLayerProps) {
  const config = BASEMAPS[basemap]
  const state = useRef(INITIAL_TILE_FAILURE_STATE)

  const record = (event: TileEvent) => {
    const next = tileFailureReducer(state.current, event)
    if (next.unavailable !== state.current.unavailable) {
      onAvailabilityChange(basemap, !next.unavailable)
    }
    state.current = next
  }

  return (
    <TileLayer
      url={config.url}
      attribution={config.attribution}
      subdomains={config.subdomains ?? 'abc'}
      maxNativeZoom={config.maxNativeZoom}
      maxZoom={MAP_MAX_ZOOM}
      eventHandlers={{
        tileerror: () => record({ type: 'tileerror' }),
        tileload: () => record({ type: 'tileload' }),
      }}
    />
  )
})
