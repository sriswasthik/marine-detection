import { divIcon } from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker, Rectangle } from 'react-leaflet'
import type { GeoBounds } from '@/features/observations/types'
import { boundsToLeaflet } from '@/lib/geo'
import { footprintLabel, getFootprintStyle } from '@/lib/map/detectionStyle'

/** Outline of the source image. Dotted and labelled "Approximate" when the CRS is unknown. */
export const FootprintLayer = memo(function FootprintLayer({
  bounds,
  approximate,
  onImagery,
}: {
  bounds: GeoBounds
  approximate: boolean
  onImagery: boolean
}) {
  const leafletBounds = useMemo(() => boundsToLeaflet(bounds), [bounds])
  const label = useMemo(
    () =>
      divIcon({
        className: 'mwi-footprint-label',
        html: `<span>${footprintLabel(approximate)}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    [approximate],
  )
  return (
    <>
      <Rectangle
        bounds={leafletBounds}
        pathOptions={getFootprintStyle(approximate, onImagery)}
        interactive={false}
      />
      <Marker
        position={[bounds.north, bounds.west]}
        icon={label}
        interactive={false}
        keyboard={false}
      />
    </>
  )
})
