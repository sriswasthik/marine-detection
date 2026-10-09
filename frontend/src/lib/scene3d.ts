/**
 * Pure geometry for the 3D scenes (src/features/scene3d): where things sit on the globe, the
 * Sentinel-2 orbit, the spectral stack and the density relief. No three.js here, so it can be
 * unit tested; the scenes turn these numbers into meshes.
 */
import type { DensityLevel, GeoBounds, ObservationSummary } from '@/features/observations/types'
import { MODEL_INPUT } from './config'
import type { DensityGrid } from './density'
import { boundsCenter } from './geo'

export type Vec3 = readonly [number, number, number]

/**
 * A point on a sphere for a latitude and longitude in degrees, in three.js axes: y up through the
 * north pole, longitude 0 on +x and longitude 90 east on -z.
 */
export function latLngToVector3(lat: number, lng: number, radius = 1): Vec3 {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ]
}

/** The inverse of latLngToVector3, for any non-zero vector. */
export function vector3ToLatLng([x, y, z]: Vec3): { lat: number; lng: number } {
  const radius = Math.hypot(x, y, z)
  const lat = 90 - (Math.acos(y / radius) * 180) / Math.PI
  let lng = (Math.atan2(z, -x) * 180) / Math.PI - 180
  if (lng < -180) lng += 360
  return { lat, lng }
}

/**
 * Sample positions over the whole globe, about `stepDeg` apart in both directions: rows of
 * latitude, each with fewer longitudes towards the poles, so the dots stay evenly spaced.
 */
export function globeSamplePositions(stepDeg: number): { lat: number; lng: number }[] {
  if (!(stepDeg > 0)) throw new RangeError('The sample step must be a positive number of degrees.')
  const points: { lat: number; lng: number }[] = []
  for (let lat = -90 + stepDeg / 2; lat < 90; lat += stepDeg) {
    const perRow = Math.max(1, Math.round((360 / stepDeg) * Math.cos((lat * Math.PI) / 180)))
    for (let i = 0; i < perRow; i++) points.push({ lat, lng: -180 + (360 * (i + 0.5)) / perRow })
  }
  return points
}

/**
 * Sentinel-2's orbit: sun-synchronous, 786 km up, 98.62 degrees, a 290 km swath. With both
 * satellites (2A and 2B) every coast is imaged at least every 5 days.
 */
export const SENTINEL2 = {
  altitudeKm: 786,
  inclinationDeg: 98.62,
  swathKm: 290,
  periodMin: 100.6,
  revisitDays: 5,
} as const

export const EARTH_RADIUS_KM = 6371

/** Orbit radius in globe units (the Earth is 1). */
export function orbitRadius(altitudeKm: number = SENTINEL2.altitudeKm): number {
  return 1 + altitudeKm / EARTH_RADIUS_KM
}

/**
 * Position on a circular orbit: `angle` radians along the orbit from the ascending node,
 * `inclinationDeg` from the equator, the node at longitude `nodeDeg`.
 */
export function orbitPosition(
  angle: number,
  radius: number,
  inclinationDeg: number = SENTINEL2.inclinationDeg,
  nodeDeg = 0,
): Vec3 {
  const inc = (inclinationDeg * Math.PI) / 180
  const node = (nodeDeg * Math.PI) / 180
  // In the orbital plane, then tilted about the line of nodes, then turned to the node longitude.
  const px = Math.cos(angle) * radius
  const py = Math.sin(angle) * radius
  const x = px
  const y = py * Math.sin(inc)
  const z = py * Math.cos(inc)
  return [x * Math.cos(node) + z * Math.sin(node), y, -x * Math.sin(node) + z * Math.cos(node)]
}

/** Half-angle of the swath seen from the satellite, radians (flat-Earth approximation). */
export function swathHalfAngle(
  swathKm: number = SENTINEL2.swathKm,
  altitudeKm: number = SENTINEL2.altitudeKm,
): number {
  return Math.atan(swathKm / 2 / altitudeKm)
}

export interface GlobeMarker {
  id: string
  region: string
  lat: number
  lng: number
  /** Null for observations with no debris (or no result yet). */
  level: DensityLevel | null
  detectionCount: number
  /** Height of the light beam above the surface, globe units: grows with the detection count. */
  beamHeight: number
}

/** Beam height for a number of detections: logarithmic, so one big scene does not dwarf the rest. */
export function beamHeight(detectionCount: number): number {
  return 0.06 + 0.09 * Math.log10(1 + Math.max(0, detectionCount))
}

/** One marker per observation with bounds, at the centre of its image. */
export function globeMarkers(
  observations: readonly Pick<
    ObservationSummary,
    'id' | 'region' | 'bounds' | 'densityLevel' | 'detectionCount'
  >[],
): GlobeMarker[] {
  const markers: GlobeMarker[] = []
  for (const observation of observations) {
    if (!observation.bounds) continue
    const { lat, lng } = boundsCenter(observation.bounds)
    markers.push({
      id: observation.id,
      region: observation.region,
      lat,
      lng,
      level: observation.densityLevel,
      detectionCount: observation.detectionCount,
      beamHeight: beamHeight(observation.detectionCount),
    })
  }
  return markers
}

/** Great-circle angle between two points, degrees. */
export function angularDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const [ax, ay, az] = latLngToVector3(a.lat, a.lng)
  const [bx, by, bz] = latLngToVector3(b.lat, b.lng)
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz))
  return (Math.acos(dot) * 180) / Math.PI
}

/** Markers within this many degrees of each other count as one cluster for the globe's focus. */
export const FOCUS_CLUSTER_DEG = 30

/**
 * The centre the globe should turn to first: the middle of the densest cluster of markers (so
 * scenes on two continents do not average out to the empty sea between them), or the Indian
 * Ocean without any.
 */
export function globeFocus(markers: readonly Pick<GlobeMarker, 'lat' | 'lng'>[]): {
  lat: number
  lng: number
} {
  if (markers.length === 0) return { lat: 12, lng: 78 }
  let best: Pick<GlobeMarker, 'lat' | 'lng'>[] = []
  for (const m of markers) {
    const near = markers.filter((other) => angularDistance(m, other) <= FOCUS_CLUSTER_DEG)
    if (near.length > best.length) best = near
  }
  // Mean on the unit sphere, so markers either side of the antimeridian do not cancel out.
  let x = 0
  let y = 0
  let z = 0
  for (const m of best) {
    const [vx, vy, vz] = latLngToVector3(m.lat, m.lng)
    x += vx
    y += vy
    z += vz
  }
  if (Math.hypot(x, y, z) < 1e-9) return { lat: best[0]!.lat, lng: best[0]!.lng }
  return vector3ToLatLng([x, y, z])
}

export interface SpectralBand {
  /** Sentinel-2 band name. */
  name: string
  wavelengthNm: number
  /** Display colour: visible bands in their own hue, infrared bands in false colour. */
  color: string
  region: 'Visible' | 'Red edge' | 'Near infrared' | 'Shortwave infrared'
}

const BAND_NAMES = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'] as const

/** Display colour per band, blue through red, then false colour for what the eye cannot see. */
const BAND_COLORS = [
  '#5b6cff',
  '#3d9bff',
  '#2de27a',
  '#ff5a5f',
  '#ff3d8b',
  '#e04cff',
  '#b45cff',
  '#8b6cff',
  '#6f7dff',
  '#ffb547',
  '#ff8a3d',
] as const

function bandRegion(nm: number): SpectralBand['region'] {
  if (nm < 700) return 'Visible'
  if (nm < 800) return 'Red edge'
  if (nm < 1000) return 'Near infrared'
  return 'Shortwave infrared'
}

/** The 11 bands the model reads, in its input order (src/lib/config.ts MODEL_INPUT). */
export const SPECTRAL_BANDS: readonly SpectralBand[] = MODEL_INPUT.wavelengthsNm.map((nm, i) => ({
  name: BAND_NAMES[i] ?? `B${i + 1}`,
  wavelengthNm: nm,
  color: BAND_COLORS[i] ?? '#8fa6be',
  region: bandRegion(nm),
}))

export interface ReliefBar {
  /** Cell id from the density grid. */
  id: string
  /** Centre in relief space: x west to east and z north to south, both -1 to 1. */
  x: number
  z: number
  /** Footprint of the bar in relief space. */
  width: number
  depth: number
  /** Bar height: the square root of coverage, so small cells stay visible next to dense ones. */
  height: number
  level: DensityLevel
  coveragePercent: number
  debrisAreaM2: number
}

/** Height of a bar at 100% coverage, in relief units. */
export const RELIEF_MAX_HEIGHT = 0.9

/**
 * The density grid as bars on a square: one bar per cell holding debris. The grid's longer side
 * spans -1 to 1; the shorter side keeps the aspect ratio.
 */
export function reliefBars(grid: Pick<DensityGrid, 'rows' | 'cols' | 'cells'>): ReliefBar[] {
  const span = Math.max(grid.rows, grid.cols)
  const cell = 2 / span
  const offsetX = (grid.cols * cell) / 2
  const offsetZ = (grid.rows * cell) / 2
  const bars: ReliefBar[] = []
  for (const c of grid.cells) {
    if (!c.level || c.coveragePercent <= 0) continue
    bars.push({
      id: c.id,
      x: (c.col + 0.5) * cell - offsetX,
      // Row 0 is the south edge; south is +z (towards the viewer).
      z: offsetZ - (c.row + 0.5) * cell,
      width: cell,
      depth: cell,
      height: Math.max(0.02, RELIEF_MAX_HEIGHT * Math.sqrt(Math.min(100, c.coveragePercent) / 100)),
      level: c.level,
      coveragePercent: c.coveragePercent,
      debrisAreaM2: c.debrisAreaM2,
    })
  }
  return bars
}

/** Size of the relief's base in relief units, for a grid of rows x cols. */
export function reliefExtent(grid: Pick<DensityGrid, 'rows' | 'cols'>): {
  width: number
  depth: number
} {
  const span = Math.max(grid.rows, grid.cols)
  return { width: (2 * grid.cols) / span, depth: (2 * grid.rows) / span }
}

/** A geographic point inside `bounds` in relief space (see reliefBars). */
export function reliefPosition(
  point: { lat: number; lng: number },
  bounds: GeoBounds,
  grid: Pick<DensityGrid, 'rows' | 'cols'>,
): { x: number; z: number } {
  const { width, depth } = reliefExtent(grid)
  const u = (point.lng - bounds.west) / (bounds.east - bounds.west || 1)
  const v = (point.lat - bounds.south) / (bounds.north - bounds.south || 1)
  return { x: (u - 0.5) * width, z: (0.5 - v) * depth }
}

export type PipelinePhase = 'idle' | 'upload' | 'preprocess' | 'detect' | 'map' | 'done' | 'failed'
type StepState = 'pending' | 'active' | 'done' | 'failed'

/**
 * The pipeline step the spectral stack shows, from the job's step statuses (in order: upload,
 * preprocess, detect, map). A failure anywhere wins; then the active step; all done is done.
 */
export function pipelinePhase(
  statuses: Readonly<Record<'upload' | 'preprocess' | 'detect' | 'map', StepState>>,
): PipelinePhase {
  const steps = ['upload', 'preprocess', 'detect', 'map'] as const
  if (steps.some((step) => statuses[step] === 'failed')) return 'failed'
  const active = steps.find((step) => statuses[step] === 'active')
  if (active) return active
  if (steps.every((step) => statuses[step] === 'done')) return 'done'
  return 'idle'
}
