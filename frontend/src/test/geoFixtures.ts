import type { Polygon } from 'geojson'
import type { Detection, DensityLevel, GeoBounds } from '@/features/observations/types'
import {
  createLocalProjection,
  geometryAreaM2,
  geometryCentroid,
  metersPerDegreeLat,
  metersPerDegreeLng,
} from '@/lib/geo'
import type { Point } from '@/lib/polygon'

/** A scene of known size in meters, with helpers to place shapes in local meters. */
export function makeScene(widthM: number, heightM: number, south = 10, west = 80) {
  const guessMid = south + heightM / 2 / 110_600
  const north = south + heightM / metersPerDegreeLat(guessMid)
  const midLat = (north + south) / 2
  const east = west + widthM / metersPerDegreeLng(midLat)
  const bounds: GeoBounds = { north, south, east, west }
  const projection = createLocalProjection({ lat: south, lng: west }, midLat)

  const ring = (points: readonly Point[]) => {
    const positions = points.map((p) => projection.toPosition(p))
    const first = positions[0]
    if (first) positions.push([...first])
    return positions
  }
  const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
  const polygon = (...rings: (readonly Point[])[]): Polygon => ({
    type: 'Polygon',
    coordinates: rings.map(ring),
  })

  return { bounds, projection, ring, rect, polygon }
}

export function makeDetection(
  id: string,
  geometry: Polygon,
  overrides: Partial<Omit<Detection, 'id' | 'geometry'>> = {},
): Detection {
  const areaM2 = geometryAreaM2(geometry)
  return {
    id,
    geometry,
    areaM2,
    confidence: 0.8,
    densityLevel: 'low' satisfies DensityLevel,
    centroid: geometryCentroid(geometry),
    sourcePixelCount: Math.round(areaM2 / 100),
    ...overrides,
  }
}
