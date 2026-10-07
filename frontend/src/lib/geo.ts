/**
 * Geographic helpers.
 *
 * Coordinate order: GeoJSON positions are [lng, lat]; Leaflet tuples are [lat, lng].
 * This file is the only place that converts between the two. Do not swap indices elsewhere.
 */
import { area as turfArea } from '@turf/area'
import { bbox as turfBbox } from '@turf/bbox'
import { centroid as turfCentroid } from '@turf/centroid'
import { polygon as turfPolygon } from '@turf/helpers'
import type { BBox, Polygon, Position } from 'geojson'
import type { DetectionGeometry, GeoBounds, LatLng } from '@/features/observations/types'
import type { Point } from '@/lib/polygon'

/** GeoJSON position: [lng, lat]. */
export type LngLatPosition = [lng: number, lat: number]
/** Leaflet tuple: [lat, lng]. Structurally compatible with Leaflet's LatLngTuple. */
export type LatLngTuple = [lat: number, lng: number]
/** Leaflet bounds tuple: [[south, west], [north, east]]. */
export type LatLngBoundsTuple = [southWest: LatLngTuple, northEast: LatLngTuple]

/** Mean Earth radius (IUGG), meters. The same value @turf/area uses. */
export const EARTH_RADIUS_M = 6_371_008.8

function lngOf(position: Position): number {
  const lng = position[0]
  if (lng === undefined) throw new TypeError('GeoJSON position is missing its longitude.')
  return lng
}

function latOf(position: Position): number {
  const lat = position[1]
  if (lat === undefined) throw new TypeError('GeoJSON position is missing its latitude.')
  return lat
}

// ---------------------------------------------------------------------------
// Coordinate order conversion
// ---------------------------------------------------------------------------

/** GeoJSON [lng, lat] to Leaflet [lat, lng]. */
export function toLatLngTuple(position: Position): LatLngTuple {
  return [latOf(position), lngOf(position)]
}

/** Leaflet [lat, lng] to GeoJSON [lng, lat]. */
export function toLngLatPosition(tuple: LatLngTuple): LngLatPosition {
  return [tuple[1], tuple[0]]
}

export function positionToLatLng(position: Position): LatLng {
  return { lat: latOf(position), lng: lngOf(position) }
}

export function latLngToPosition(point: LatLng): LngLatPosition {
  return [point.lng, point.lat]
}

export function latLngToTuple(point: LatLng): LatLngTuple {
  return [point.lat, point.lng]
}

export function tupleToLatLng(tuple: LatLngTuple): LatLng {
  return { lat: tuple[0], lng: tuple[1] }
}

export function ringToLeaflet(ring: readonly Position[]): LatLngTuple[] {
  return ring.map(toLatLngTuple)
}

/**
 * Geometry to Leaflet positions: polygons, then rings, then [lat, lng] points.
 * A Polygon becomes a one-element array, so both geometry types share one shape.
 */
export function geometryToLeaflet(geometry: DetectionGeometry): LatLngTuple[][][] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.map((rings) => rings.map(ringToLeaflet))
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

export function boundsToLeaflet(bounds: GeoBounds): LatLngBoundsTuple {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ]
}

export function leafletToBounds(tuple: LatLngBoundsTuple): GeoBounds {
  const [[south, west], [north, east]] = tuple
  return { north, south, east, west }
}

/** GeoJSON bbox order: [west, south, east, north]. */
export function boundsToBBox(bounds: GeoBounds): [number, number, number, number] {
  return [bounds.west, bounds.south, bounds.east, bounds.north]
}

export function bboxToBounds(bbox: BBox): GeoBounds {
  // A 3D bbox is [west, south, minZ, east, north, maxZ].
  const [west, south, east, north] = bbox.length === 6 ? [bbox[0], bbox[1], bbox[3], bbox[4]] : bbox
  return { north, south, east, west }
}

export function geometryBounds(geometry: DetectionGeometry): GeoBounds {
  return bboxToBounds(turfBbox(geometry))
}

export function unionBounds(a: GeoBounds, b: GeoBounds): GeoBounds {
  return {
    north: Math.max(a.north, b.north),
    south: Math.min(a.south, b.south),
    east: Math.max(a.east, b.east),
    west: Math.min(a.west, b.west),
  }
}

/** Union of the bounds of all geometries, or null for an empty list. */
export function boundsOfGeometries(geometries: readonly DetectionGeometry[]): GeoBounds | null {
  let result: GeoBounds | null = null
  for (const geometry of geometries) {
    const bounds = geometryBounds(geometry)
    result = result ? unionBounds(result, bounds) : bounds
  }
  return result
}

export function boundsCenter(bounds: GeoBounds): LatLng {
  return { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }
}

export function boundsContain(bounds: GeoBounds, point: LatLng): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lng >= bounds.west &&
    point.lng <= bounds.east
  )
}

/** Counter-clockwise GeoJSON polygon covering the bounds. */
export function boundsToPolygon(bounds: GeoBounds): Polygon {
  const { north, south, east, west } = bounds
  return turfPolygon([
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ]).geometry
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/** Geodesic area in square meters. */
export function geometryAreaM2(geometry: DetectionGeometry): number {
  return turfArea(geometry)
}

export function boundsAreaM2(bounds: GeoBounds): number {
  return turfArea(boundsToPolygon(bounds))
}

/** Mean-of-vertices centroid as { lat, lng }. */
export function geometryCentroid(geometry: DetectionGeometry): LatLng {
  return positionToLatLng(turfCentroid(geometry).geometry.coordinates)
}

/** Distinct vertices across all rings; the repeated closing vertex is not counted. */
export function countVertices(geometry: DetectionGeometry): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let count = 0
  for (const rings of polygons) {
    for (const ring of rings) {
      const first = ring[0]
      const last = ring[ring.length - 1]
      const closed =
        ring.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]
      count += closed ? ring.length - 1 : ring.length
    }
  }
  return count
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Great-circle distance in meters. */
export function haversineDistanceM(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// ---------------------------------------------------------------------------
// Meters and degrees
//
// Uses the same spherical Earth as @turf/area (radius EARTH_RADIUS_M), so local projections,
// grid cells and geodesic polygon areas agree and every figure on screen adds up. The difference
// from the WGS84 ellipsoid is under 0.6%, well inside the model's own uncertainty.
// ---------------------------------------------------------------------------

const METERS_PER_DEGREE = (EARTH_RADIUS_M * Math.PI) / 180

export function metersPerDegreeLat(_latitude?: number): number {
  return METERS_PER_DEGREE
}

export function metersPerDegreeLng(latitude: number): number {
  return METERS_PER_DEGREE * Math.cos(toRadians(latitude))
}

export function metersToDegrees(
  offset: { dxM: number; dyM: number },
  atLatitude: number,
): { dLng: number; dLat: number } {
  return {
    dLng: offset.dxM / metersPerDegreeLng(atLatitude),
    dLat: offset.dyM / metersPerDegreeLat(atLatitude),
  }
}

export function degreesToMeters(
  offset: { dLng: number; dLat: number },
  atLatitude: number,
): { dxM: number; dyM: number } {
  return {
    dxM: offset.dLng * metersPerDegreeLng(atLatitude),
    dyM: offset.dLat * metersPerDegreeLat(atLatitude),
  }
}

export interface LocalProjection {
  /** [lng, lat] to local meters [x east, y north] from the origin. */
  toMeters(position: Position): Point
  /** Local meters back to [lng, lat]. */
  toPosition(point: Point): LngLatPosition
}

/**
 * Equirectangular projection around a reference latitude. Accurate for areas a few kilometers
 * across, which covers a single satellite or drone scene.
 */
export function createLocalProjection(
  origin: LatLng,
  referenceLatitude = origin.lat,
): LocalProjection {
  const mLng = metersPerDegreeLng(referenceLatitude)
  const mLat = metersPerDegreeLat(referenceLatitude)
  return {
    toMeters: (position) => [
      (lngOf(position) - origin.lng) * mLng,
      (latOf(position) - origin.lat) * mLat,
    ],
    toPosition: ([x, y]) => [origin.lng + x / mLng, origin.lat + y / mLat],
  }
}
