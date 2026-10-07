import type { Position } from 'geojson'
import type { DetectionGeometry, GeoBounds } from '@/features/observations/types'

/**
 * Projects detection outlines into an SVG view box covering `bounds`, for small mask thumbnails.
 * Linear in latitude and longitude: at thumbnail size over an image footprint the difference from
 * Web Mercator is far below a pixel. North is up.
 */
export function geometryToSvgPath(
  geometry: DetectionGeometry,
  bounds: GeoBounds,
  width: number,
  height: number,
): string {
  const spanLng = bounds.east - bounds.west
  const spanLat = bounds.north - bounds.south
  if (!(spanLng > 0) || !(spanLat > 0) || !(width > 0) || !(height > 0)) return ''
  const round = (value: number) => Math.round(value * 10) / 10
  const point = ([lng = 0, lat = 0]: Position) =>
    `${round(((lng - bounds.west) / spanLng) * width)} ${round(((bounds.north - lat) / spanLat) * height)}`
  const ring = (positions: readonly Position[]) =>
    positions.length < 3 ? '' : `M${positions.map(point).join('L')}Z`
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.flatMap((rings) => rings.map(ring)).join('')
}
