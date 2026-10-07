import { tooltip, type PointExpression } from 'leaflet'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import type { LatLngTuple } from '@/lib/geo'

const DEFAULT_OFFSET: PointExpression = [0, -8]

/**
 * A single map tooltip at a position, with React content. react-leaflet's Tooltip only opens
 * when bound to a parent layer; one shared tooltip is also cheaper than one per detection.
 */
export function HoverTooltip({
  position,
  offset = DEFAULT_OFFSET,
  children,
}: {
  position: LatLngTuple
  offset?: PointExpression
  children: ReactNode
}) {
  const map = useMap()
  const [container] = useState(() => document.createElement('div'))
  // One Leaflet tooltip per mount, opened and closed through the map's own API, so a
  // re-run effect never leaves a second, empty tooltip behind.
  const [tip] = useState(() =>
    tooltip({ direction: 'top', offset, opacity: 1, className: 'mwi-tooltip' }).setContent(
      container,
    ),
  )
  const [lat, lng] = position

  useEffect(() => {
    tip.setLatLng([lat, lng])
    map.openTooltip(tip)
    return () => {
      map.closeTooltip(tip)
    }
  }, [map, tip, lat, lng])

  return createPortal(children, container)
}
