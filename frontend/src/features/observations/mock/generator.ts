/**
 * Synthetic debris generator for the mock backend.
 *
 * Works in pixel space first, then converts to geography:
 * 1. Clusters of streaks (windrows) elongated along a per-scene drift bearing, plus a long tail
 *    of small scattered patches.
 * 2. Each detection is an irregular polygon with 6 to 12 vertices, sized from a log-normal
 *    distribution, snapped to the pixel grid, simple (no self-intersections), inside the scene
 *    and not overlapping any other detection, like connected components of a segmentation mask.
 *    The smallest patches can end up with as few as 4 vertices after snapping.
 * 3. Pixels convert to [lng, lat] with the local meters-to-degrees factors at the scene latitude.
 *    Areas come from the final polygon via @turf/area, so every figure is self-consistent.
 */
import type { Polygon, Position } from 'geojson'
import { gridCellSizeForResolution, MODEL_CARD, PLACEHOLDER_MODEL_METRICS } from '@/lib/config'
import { computeDensityGrid, observationDensityLevel } from '@/lib/density'
import {
  boundsAreaM2,
  geometryAreaM2,
  geometryCentroid,
  metersPerDegreeLat,
  metersPerDegreeLng,
} from '@/lib/geo'
import {
  dedupeRing,
  isSimpleRing,
  rectsOverlap,
  ringBBox,
  ringSignedArea,
  ringsOverlap,
  type Point,
  type Rect,
} from '@/lib/polygon'
import { slugify } from '@/lib/format'
import type {
  Detection,
  GeoBounds,
  LatLng,
  Observation,
  ObservationSource,
  ObservationStatus,
  ObservationWarning,
} from '../types'
import { createRandom, type Random } from './random'

export interface ClusterSpec {
  /** Cluster centre as a share of the scene: [from the west edge, from the south edge], 0 to 1. */
  at: readonly [number, number]
  /** One standard deviation of spread in pixels: [along the drift, across the drift]. */
  spreadPx: readonly [number, number]
  count: number
  /** Median detection area in pixels. */
  medianAreaPx: number
  /** Largest detection area in pixels. */
  maxAreaPx: number
  /** 0 to 1. How packed and distinct the cluster is; raises confidence. */
  intensity: number
  /** Length-to-width ratio range of the streaks. */
  aspect?: readonly [number, number]
}

export interface TailSpec {
  count: number
  medianAreaPx: number
  maxAreaPx: number
}

export interface SceneSpec {
  id: string
  seed: string
  name: string
  region: string
  source: ObservationSource
  capturedAt: string
  status: ObservationStatus
  crs: string | null
  center: LatLng
  /** Scene size in pixels: [width, height]. */
  sizePx: readonly [number, number]
  resolutionM: number
  /** Direction the surface drift moves toward, degrees clockwise from north. */
  driftBearingDeg: number
  clusters: readonly ClusterSpec[]
  tail: TailSpec
  /** Shifts all confidences and sets the share of low-confidence outliers. */
  confidence?: { shift: number; outlierRate: number }
  cloudCoveragePercent: number
  warnings?: readonly ObservationWarning[]
  /** Seconds between capture and the start of processing, and processing duration. */
  processing: { delaySeconds: number; durationSeconds: number }
}

const MIN_AREA_PX = 2
const AREA_SIGMA = 0.75
const DEFAULT_ASPECT: readonly [number, number] = [3, 8]
const TAIL_ASPECT: readonly [number, number] = [1.2, 3.5]
const MIN_SEMI_AXIS_PX = 0.75
const PLACEMENT_ATTEMPTS = 60
const COORDINATE_DIGITS = 8
const DEFAULT_OUTLIER_RATE = 0.07

interface PlacedShape {
  ring: Point[]
  box: Rect
  areaPx: number
  intensity: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Unit vector for a compass bearing, in pixel axes (x east, y north). */
function bearingVector(bearingDeg: number): Point {
  const radians = (bearingDeg * Math.PI) / 180
  return [Math.sin(radians), Math.cos(radians)]
}

function irregularStreak(
  rng: Random,
  center: Point,
  areaPx: number,
  aspectRange: readonly [number, number],
  drift: Point,
): Point[] {
  const aspect = rng.range(aspectRange[0], aspectRange[1])
  let across = Math.sqrt(areaPx / (Math.PI * aspect))
  let along = aspect * across
  if (across < MIN_SEMI_AXIS_PX) {
    across = MIN_SEMI_AXIS_PX
    along = Math.max(areaPx / (Math.PI * across), across)
  }
  // Each streak deviates a little from the drift axis.
  const wobble = rng.normal(0, 0.12)
  const ux = drift[0] * Math.cos(wobble) - drift[1] * Math.sin(wobble)
  const uy = drift[0] * Math.sin(wobble) + drift[1] * Math.cos(wobble)

  const vertexCount = rng.int(6, 12)
  const step = (2 * Math.PI) / vertexCount
  const ring: Point[] = []
  for (let i = 0; i < vertexCount; i++) {
    const theta = i * step + rng.range(-0.35, 0.35) * step
    const radius = 1 + rng.range(-0.25, 0.18)
    const u = along * Math.cos(theta) * radius
    const v = across * Math.sin(theta) * radius
    const x = center[0] + u * ux - v * uy
    const y = center[1] + u * uy + v * ux
    ring.push([Math.round(x), Math.round(y)])
  }
  const cleaned = dedupeRing(ring)
  return ringSignedArea(cleaned) < 0 ? cleaned.reverse() : cleaned
}

function isAcceptable(ring: readonly Point[], areaPx: number, width: number, height: number) {
  if (ring.length < 4 || ring.length > 12) return false
  if (areaPx >= 10 && ring.length < 6) return false
  if (areaPx < MIN_AREA_PX) return false
  const box = ringBBox(ring)
  if (box.minX < 1 || box.minY < 1 || box.maxX > width - 1 || box.maxY > height - 1) return false
  return isSimpleRing(ring)
}

const PIXEL_SHIFTS: readonly Point[] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * True when two rings overlap or come within one pixel of each other. Separate mask
 * components always have at least one clear pixel between them.
 */
function withinOnePixel(a: readonly Point[], b: readonly Point[]): boolean {
  return PIXEL_SHIFTS.some(([dx, dy]) =>
    ringsOverlap(
      a.map(([x, y]): Point => [x + dx, y + dy]),
      b,
    ),
  )
}

function placeShape(
  rng: Random,
  placed: PlacedShape[],
  scene: { width: number; height: number; drift: Point },
  sampleCenter: () => Point,
  size: { medianAreaPx: number; maxAreaPx: number; aspect: readonly [number, number] },
  intensity: number,
): PlacedShape | null {
  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
    const target = clamp(rng.logNormal(size.medianAreaPx, AREA_SIGMA), MIN_AREA_PX, size.maxAreaPx)
    const ring = irregularStreak(rng, sampleCenter(), target, size.aspect, scene.drift)
    const areaPx = Math.abs(ringSignedArea(ring))
    if (areaPx > size.maxAreaPx) continue
    if (!isAcceptable(ring, areaPx, scene.width, scene.height)) continue
    const box = ringBBox(ring)
    const collides = placed.some(
      (other) => rectsOverlap(box, other.box, 1) && withinOnePixel(ring, other.ring),
    )
    if (collides) continue
    return { ring, box, areaPx, intensity }
  }
  return null
}

function confidenceFor(rng: Random, areaPx: number, intensity: number, spec: SceneSpec): number {
  const sizeScore = clamp(Math.log(areaPx / MIN_AREA_PX) / Math.log(150 / MIN_AREA_PX), 0, 1)
  const shift = spec.confidence?.shift ?? 0
  const outlierRate = spec.confidence?.outlierRate ?? DEFAULT_OUTLIER_RATE
  let value = 0.5 + 0.3 * sizeScore + 0.14 * intensity + rng.normal(0, 0.035) + shift
  if (rng.chance(outlierRate)) value = rng.range(0.3, 0.52)
  return round(clamp(value, 0.3, 0.99), 3)
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString().replace('.000Z', 'Z')
}

/** Scene bounds, rounded so pixel conversion and stored bounds agree exactly. */
export function sceneBounds(spec: Pick<SceneSpec, 'center' | 'sizePx' | 'resolutionM'>): GeoBounds {
  const halfWidthM = (spec.sizePx[0] * spec.resolutionM) / 2
  const halfHeightM = (spec.sizePx[1] * spec.resolutionM) / 2
  const dLng = halfWidthM / metersPerDegreeLng(spec.center.lat)
  const dLat = halfHeightM / metersPerDegreeLat(spec.center.lat)
  return {
    north: round(spec.center.lat + dLat, COORDINATE_DIGITS),
    south: round(spec.center.lat - dLat, COORDINATE_DIGITS),
    east: round(spec.center.lng + dLng, COORDINATE_DIGITS),
    west: round(spec.center.lng - dLng, COORDINATE_DIGITS),
  }
}

/** Generates one complete, self-consistent observation. Same spec, same output. */
export function generateObservation(spec: SceneSpec): Observation {
  const rng = createRandom(spec.seed)
  const [width, height] = spec.sizePx
  const drift = bearingVector(spec.driftBearingDeg)
  const across: Point = [-drift[1], drift[0]]
  const scene = { width, height, drift }
  const placed: PlacedShape[] = []

  for (const cluster of spec.clusters) {
    const cx = cluster.at[0] * width
    const cy = cluster.at[1] * height
    const sampleCenter = (): Point => {
      const a = rng.normal(0, cluster.spreadPx[0])
      const c = rng.normal(0, cluster.spreadPx[1])
      return [cx + a * drift[0] + c * across[0], cy + a * drift[1] + c * across[1]]
    }
    for (let i = 0; i < cluster.count; i++) {
      const shape = placeShape(
        rng,
        placed,
        scene,
        sampleCenter,
        { ...cluster, aspect: cluster.aspect ?? DEFAULT_ASPECT },
        cluster.intensity,
      )
      if (shape) placed.push(shape)
    }
  }

  const sampleAnywhere = (): Point => [rng.range(2, width - 2), rng.range(2, height - 2)]
  for (let i = 0; i < spec.tail.count; i++) {
    const shape = placeShape(
      rng,
      placed,
      scene,
      sampleAnywhere,
      { ...spec.tail, aspect: TAIL_ASPECT },
      0,
    )
    if (shape) placed.push(shape)
  }

  const bounds = sceneBounds(spec)
  const mLng = metersPerDegreeLng(spec.center.lat)
  const mLat = metersPerDegreeLat(spec.center.lat)
  const toPosition = ([x, y]: Point): Position => [
    round(bounds.west + (x * spec.resolutionM) / mLng, COORDINATE_DIGITS),
    round(bounds.south + (y * spec.resolutionM) / mLat, COORDINATE_DIGITS),
  ]
  const pixelAreaM2 = spec.resolutionM ** 2

  const unlabelled = placed
    .map((shape) => {
      const coordinates = shape.ring.map(toPosition)
      const first = coordinates[0]
      if (first) coordinates.push([...first])
      const geometry: Polygon = { type: 'Polygon', coordinates: [coordinates] }
      const areaM2 = round(geometryAreaM2(geometry), 4)
      const centroid = geometryCentroid(geometry)
      return {
        geometry,
        areaM2,
        confidence: confidenceFor(rng, shape.areaPx, shape.intensity, spec),
        centroid: {
          lat: round(centroid.lat, COORDINATE_DIGITS),
          lng: round(centroid.lng, COORDINATE_DIGITS),
        },
        sourcePixelCount: Math.round(areaM2 / pixelAreaM2),
      }
    })
    .sort((a, b) => b.areaM2 - a.areaM2)
    .map((detection, index) => ({
      id: `${spec.id}-d${String(index + 1).padStart(3, '0')}`,
      ...detection,
    }))

  const grid = computeDensityGrid(unlabelled, bounds, gridCellSizeForResolution(spec.resolutionM))
  const detections: Detection[] = unlabelled.map((d) => ({
    ...d,
    densityLevel: grid.detectionLevels[d.id] ?? 'low',
  }))

  const debrisAreaM2 = round(
    detections.reduce((sum, d) => sum + d.areaM2, 0),
    4,
  )
  const waterAreaM2 = round(boundsAreaM2(bounds), 2)
  const averageConfidence =
    detections.length > 0
      ? round(detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length, 3)
      : null
  const startedAt = addSeconds(spec.capturedAt, spec.processing.delaySeconds)
  const slug = slugify(spec.name)

  return {
    id: spec.id,
    name: spec.name,
    source: spec.source,
    capturedAt: spec.capturedAt,
    region: spec.region,
    imageUrl: `/samples/${slug}/image.png`,
    previewUrl: `/samples/${slug}/preview.png`,
    maskUrl: `/samples/${slug}/mask.png`,
    bounds,
    crs: spec.crs,
    status: spec.status,
    debrisAreaM2,
    waterAreaM2,
    coveragePercent: waterAreaM2 > 0 ? round((debrisAreaM2 / waterAreaM2) * 100, 6) : 0,
    averageConfidence,
    densityLevel: observationDensityLevel(grid),
    detections,
    modelMetrics: { ...PLACEHOLDER_MODEL_METRICS },
    warnings: [...(spec.warnings ?? [])],
    cloudCoveragePercent: spec.cloudCoveragePercent,
    resolutionM: spec.resolutionM,
    processing: {
      startedAt,
      finishedAt: addSeconds(startedAt, spec.processing.durationSeconds),
      modelName: MODEL_CARD.name,
      modelVersion: MODEL_CARD.version,
    },
  }
}
