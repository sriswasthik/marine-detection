import type { DetectionGeometry } from '@/features/observations/types'
import { degreesToMeters, geometryBounds } from '@/lib/geo'

/** Below this on-screen size a polygon is drawn as a centroid marker so it never disappears. */
export const MIN_POLYGON_PX = 6

const EARTH_CIRCUMFERENCE_M = 40_075_016.686

/** Web Mercator ground resolution: meters per screen pixel at a zoom level and latitude. */
export function metersPerPixel(zoom: number, latitude: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / 2 ** (zoom + 8)
}

/** Longest side of the geometry's bounding box, in meters. */
export function geometryExtentM(geometry: DetectionGeometry): number {
  const b = geometryBounds(geometry)
  const { dxM, dyM } = degreesToMeters(
    { dLng: b.east - b.west, dLat: b.north - b.south },
    (b.north + b.south) / 2,
  )
  return Math.max(Math.abs(dxM), Math.abs(dyM))
}

export type DetectionRepresentation = 'polygon' | 'point'

/** A polygon when it spans at least MIN_POLYGON_PX on screen, otherwise a centroid point. */
export function detectionRepresentation(
  extentM: number,
  latitude: number,
  zoom: number,
): DetectionRepresentation {
  return extentM / metersPerPixel(zoom, latitude) < MIN_POLYGON_PX ? 'point' : 'polygon'
}
