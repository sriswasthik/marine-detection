import { control, type LatLng as LeafletLatLng, type Map as LeafletMap } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { useFormat } from '@/features/settings/settingsContext'
import { BASEMAPS, type BasemapId } from '@/lib/map/basemaps'

export interface MapStatusStripProps {
  map: LeafletMap | null
  basemap: BasemapId
  basemapUnavailable: boolean
  /** Phones: the toolbar has no room for "61 detections · 3 hotspots", so it shows here. */
  status?: string
}

/**
 * A 28px strip docked under the map: the scale bar, the coordinates under the cursor (or the map
 * centre), the basemap's name and its attribution, in full and never under another panel.
 */
export function MapStatusStrip({ map, basemap, basemapUnavailable, status }: MapStatusStripProps) {
  const fmt = useFormat()
  const scaleSlot = useRef<HTMLSpanElement | null>(null)
  const [point, setPoint] = useState<LeafletLatLng | null>(null)
  const [fromCursor, setFromCursor] = useState(false)

  useEffect(() => {
    const slot = scaleSlot.current
    if (!map || !slot) return
    // Add the control normally (it needs its map), then move its element into the strip.
    const scale = control.scale({ metric: true, imperial: false, maxWidth: 80 }).addTo(map)
    const element = scale.getContainer()
    if (element) slot.appendChild(element)
    return () => {
      scale.remove()
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    let frame = 0
    let cursorInside = false
    // At most one state update per animation frame while the cursor moves.
    const show = (latlng: LeafletLatLng, cursor: boolean) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setPoint(latlng)
        setFromCursor(cursor)
      })
    }
    const onMouseMove = (event: { latlng: LeafletLatLng }) => {
      cursorInside = true
      show(event.latlng, true)
    }
    const onMouseOut = () => {
      cursorInside = false
      show(map.getCenter(), false)
    }
    const onMoveEnd = () => {
      if (!cursorInside) show(map.getCenter(), false)
    }
    show(map.getCenter(), false)
    map.on('mousemove', onMouseMove)
    map.on('mouseout', onMouseOut)
    map.on('moveend', onMoveEnd)
    return () => {
      cancelAnimationFrame(frame)
      map.off('mousemove', onMouseMove)
      map.off('mouseout', onMouseOut)
      map.off('moveend', onMoveEnd)
    }
  }, [map])

  const config = BASEMAPS[basemap]
  return (
    <div
      data-chrome="status"
      className="mwi-readout flex h-7 min-w-0 items-center gap-4 border-t border-hairline bg-sheet px-3"
    >
      <span ref={scaleSlot} className="flex shrink-0 items-center" />
      {point ? (
        <span className="data hidden whitespace-nowrap text-ink sm:inline">
          <span className="sr-only">{fromCursor ? 'Cursor position' : 'Map centre'}: </span>
          {fmt.coordinates({ lat: point.lat, lng: point.lng })}
        </span>
      ) : null}
      {status ? (
        <span className="data whitespace-nowrap text-ink-2 sm:hidden">{status}</span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {basemapUnavailable ? (
          <span className="text-small whitespace-nowrap text-warning">Basemap unavailable</span>
        ) : (
          <span className="label hidden text-ink-2 md:inline">{config.label}</span>
        )}
        <span data-attribution="" className="text-small whitespace-nowrap text-ink-2">
          {config.attribution}
        </span>
      </span>
    </div>
  )
}
