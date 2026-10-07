/**
 * Coordinate reference system helpers for reading GeoTIFF headers: WGS84 geographic
 * (EPSG:4326) and WGS84 UTM zones (EPSG:326xx north, 327xx south), which covers Sentinel-2.
 * UTM formulas follow Snyder, "Map Projections: A Working Manual" (USGS 1987), pp. 57-64.
 */
import type { GeoBounds, LatLng } from '@/features/observations/types'
import { metersPerDegreeLng } from './geo'

const A = 6_378_137 // WGS84 semi-major axis, meters
const F = 1 / 298.257_223_563
const E2 = F * (2 - F)
const EP2 = E2 / (1 - E2)
const K0 = 0.9996
const FALSE_EASTING = 500_000
const FALSE_NORTHING_SOUTH = 10_000_000

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export interface UtmZone {
  zone: number
  hemisphere: 'north' | 'south'
}

export interface UtmPoint extends UtmZone {
  easting: number
  northing: number
}

const centralMeridian = (zone: number) => zone * 6 - 183

/** UTM zone and hemisphere for an EPSG code, or null when it is not a WGS84 UTM code. */
export function utmZoneForEpsg(epsg: number): UtmZone | null {
  if (epsg >= 32601 && epsg <= 32660) return { zone: epsg - 32600, hemisphere: 'north' }
  if (epsg >= 32701 && epsg <= 32760) return { zone: epsg - 32700, hemisphere: 'south' }
  return null
}

export function isSupportedEpsg(epsg: number | null | undefined): boolean {
  return epsg === 4326 || (epsg !== null && epsg !== undefined && utmZoneForEpsg(epsg) !== null)
}

function meridianArc(phi: number): number {
  const e4 = E2 * E2
  const e6 = e4 * E2
  return (
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  )
}

/** Latitude and longitude to UTM in the given zone (defaults to the natural zone). */
export function latLngToUtm(point: LatLng, zoneOverride?: UtmZone): UtmPoint {
  const zone = zoneOverride?.zone ?? Math.floor((point.lng + 180) / 6) + 1
  const hemisphere = zoneOverride?.hemisphere ?? (point.lat >= 0 ? 'north' : 'south')
  const phi = rad(point.lat)
  const n = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2)
  const t = Math.tan(phi) ** 2
  const c = EP2 * Math.cos(phi) ** 2
  const a = Math.cos(phi) * rad(point.lng - centralMeridian(zone))

  const easting =
    K0 *
      n *
      (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120) +
    FALSE_EASTING
  let northing =
    K0 *
    (meridianArc(phi) +
      n *
        Math.tan(phi) *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720))
  if (hemisphere === 'south') northing += FALSE_NORTHING_SOUTH
  return { zone, hemisphere, easting, northing }
}

/** UTM easting and northing back to latitude and longitude. */
export function utmToLatLng(point: UtmPoint): LatLng {
  const x = point.easting - FALSE_EASTING
  const y = point.hemisphere === 'south' ? point.northing - FALSE_NORTHING_SOUTH : point.northing
  const e4 = E2 * E2
  const e6 = e4 * E2
  const mu = y / K0 / (A * (1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256))
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)

  const sin1 = Math.sin(phi1)
  const n1 = A / Math.sqrt(1 - E2 * sin1 * sin1)
  const t1 = Math.tan(phi1) ** 2
  const c1 = EP2 * Math.cos(phi1) ** 2
  const r1 = (A * (1 - E2)) / (1 - E2 * sin1 * sin1) ** 1.5
  const d = x / (n1 * K0)

  const phi =
    phi1 -
    ((n1 * Math.tan(phi1)) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720)
  const lambda =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) /
    Math.cos(phi1)

  return { lat: deg(phi), lng: centralMeridian(point.zone) + deg(lambda) }
}

/**
 * A GeoTIFF bounding box [minX, minY, maxX, maxY] in its own CRS, as geographic bounds.
 * Null for coordinate systems this app cannot convert.
 */
export function bboxToGeoBounds(
  bbox: readonly number[],
  epsg: number | null | undefined,
): GeoBounds | null {
  const [minX, minY, maxX, maxY] = bbox
  if (
    epsg === null ||
    epsg === undefined ||
    minX === undefined ||
    minY === undefined ||
    maxX === undefined ||
    maxY === undefined ||
    ![minX, minY, maxX, maxY].every(Number.isFinite)
  ) {
    return null
  }
  if (epsg === 4326) {
    return { west: minX, south: minY, east: maxX, north: maxY }
  }
  const zone = utmZoneForEpsg(epsg)
  if (!zone) return null
  const corners = [
    [minX, minY],
    [minX, maxY],
    [maxX, minY],
    [maxX, maxY],
  ].map(([easting = 0, northing = 0]) => utmToLatLng({ ...zone, easting, northing }))
  return {
    north: Math.max(...corners.map((c) => c.lat)),
    south: Math.min(...corners.map((c) => c.lat)),
    east: Math.max(...corners.map((c) => c.lng)),
    west: Math.min(...corners.map((c) => c.lng)),
  }
}

/** Pixel size in meters from a GeoTIFF resolution [x, y] in CRS units, or null if unknown. */
export function resolutionMeters(
  resolution: readonly number[],
  epsg: number | null | undefined,
  latitude: number,
): number | null {
  const x = Math.abs(resolution[0] ?? NaN)
  if (!Number.isFinite(x) || x === 0) return null
  if (epsg === 4326) return x * metersPerDegreeLng(latitude)
  if (epsg !== null && epsg !== undefined && utmZoneForEpsg(epsg)) return x
  return null
}
