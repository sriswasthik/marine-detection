import { control, type LatLng as LeafletLatLng, type Map as LeafletMap } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { formatCoordinates } from '@/lib/format'

/**
 * Bottom-right readout: Leaflet's metric scale bar and the coordinates under the cursor,
 * or the map centre when there is no cursor (touch screens, keyboard panning).
 */
export function ReadoutStrip({ map }: { map: LeafletMap }) {
  const scaleSlot = useRef<HTMLDivElement | null>(null)
  const [point, setPoint] = useState(() => map.getCenter())
  const [fromCursor, setFromCursor] = useState(false)

  useEffect(() => {
    const slot = scaleSlot.current
    if (!slot) return
    // Add the control normally (it needs its map reference), then move its element into the strip.
    const scale = control.scale({ metric: true, imperial: false, maxWidth: 96 }).addTo(map)
    const element = scale.getContainer()
    if (element) slot.appendChild(element)
    return () => {
      scale.remove()
    }
  }, [map])

  useEffect(() => {
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

  return (
    <div className="mwi-readout pointer-events-auto flex h-7 items-center gap-3 rounded-control border border-border bg-surface px-2.5 shadow-subtle">
      <div ref={scaleSlot} className="flex items-center" />
      <span aria-hidden className="hidden h-3.5 w-px bg-border sm:block" />
      <span className="mono-label hidden whitespace-nowrap text-ink sm:inline">
        <span className="sr-only">{fromCursor ? 'Cursor position' : 'Map centre'}: </span>
        {formatCoordinates({ lat: point.lat, lng: point.lng })}
      </span>
    </div>
  )
}
