/**
 * GeoJSON exports (RFC 7946): detections and hotspots as FeatureCollections in WGS84,
 * coordinates [lng, lat]. Each collection carries an `observation` foreign member with the
 * observation's summary, what was exported, and how to read the coordinates.
 */
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson'
import type {
  DensityLevel,
  Detection,
  DetectionGeometry,
  GeoBounds,
  Observation,
} from '@/features/observations/types'
import type { DensityGrid } from '@/lib/density'
import type { Hotspot } from '@/lib/hotspots'
import { convexHullRing } from './hull'

export interface DetectionProperties {
  id: string
  observationId: string
  region: string
  source: Observation['source']
  capturedAt: string
  areaM2: number
  confidence: number
  densityLevel: DensityLevel
  centroidLat: number
  centroidLng: number
  sourcePixelCount: number
}

export interface HotspotProperties {
  id: string
  observationId: string
  rank: number
  level: DensityLevel
  totalAreaM2: number
  meanConfidence: number
  priorityScore: number
  detectionCount: number
  centroidLat: number
  centroidLng: number
}

/** What was exported, and from where. Shared by every export format. */
export interface ExportScope {
  /** ISO timestamp of the export. Passed in so builders stay pure. */
  generatedAt: string
  /** App name and version, for provenance. */
  generator: string
  /** True for synthetic sample data, so it is never mistaken for a real result. */
  sampleData: boolean
  /** Plain description of the active map filters, or null when everything is exported. */
  filters: string | null
}

export interface ObservationMember {
  id: string
  region: string
  source: Observation['source']
  capturedAt: string
  status: Observation['status']
  /** The source image's coordinate reference system; null when it had none. */
  sourceCrs: string | null
  bounds: GeoBounds | null
  /** From the observation itself, so unaffected by filters. */
  metrics: {
    detectedAreaM2: number
    waterAreaM2: number
    coveragePercent: number
    averageConfidence: number | null
    detectionCount: number
    hotspotCount: number
    densityLevel: DensityLevel | null
  }
  export: ExportScope & { featureCount: number; filtered: boolean }
  /** How to read the coordinates; present when the source CRS was not WGS84. */
  coordinateNote?: string
  model?: { name: string; version: string }
}

export type DetectionCollection = FeatureCollection<DetectionGeometry, DetectionProperties> & {
  observation: ObservationMember
}
export type HotspotCollection = FeatureCollection<Polygon, HotspotProperties> & {
  observation: ObservationMember
}

const WGS84 = new Set(['EPSG:4326', 'WGS84', 'CRS84', 'OGC:CRS84', 'URN:OGC:DEF:CRS:OGC:1.3:CRS84'])

/** Explains the coordinates when the source image was not in WGS84. */
export function coordinateNote(crs: string | null): string | undefined {
  if (crs === null) {
    return 'The source image had no coordinate reference system, so positions are approximate. Coordinates are WGS84 longitude, latitude (EPSG:4326).'
  }
  if (WGS84.has(crs.trim().toUpperCase())) return undefined
  return `Coordinates are WGS84 longitude, latitude (EPSG:4326), converted from the source image's ${crs}.`
}

function observationMember(
  observation: Observation,
  scope: ExportScope,
  featureCount: number,
  hotspotCount: number,
): ObservationMember {
  const note = coordinateNote(observation.crs)
  return {
    id: observation.id,
    region: observation.region,
    source: observation.source,
    capturedAt: observation.capturedAt,
    status: observation.status,
    sourceCrs: observation.crs,
    bounds: observation.bounds,
    metrics: {
      detectedAreaM2: observation.debrisAreaM2,
      waterAreaM2: observation.waterAreaM2,
      coveragePercent: observation.coveragePercent,
      averageConfidence: observation.averageConfidence,
      detectionCount: observation.detections.length,
      hotspotCount,
      densityLevel: observation.densityLevel,
    },
    export: { ...scope, featureCount, filtered: scope.filters !== null },
    ...(note ? { coordinateNote: note } : {}),
    ...(observation.processing
      ? {
          model: {
            name: observation.processing.modelName,
            version: observation.processing.modelVersion,
          },
        }
      : {}),
  }
}

/** One detection as a Feature. Geometry is passed through unchanged: it is already [lng, lat]. */
export function detectionFeature(
  detection: Detection,
  observation: Pick<Observation, 'id' | 'region' | 'source' | 'capturedAt'>,
): Feature<DetectionGeometry, DetectionProperties> {
  return {
    type: 'Feature',
    id: detection.id,
    geometry: detection.geometry,
    properties: {
      id: detection.id,
      observationId: observation.id,
      region: observation.region,
      source: observation.source,
      capturedAt: observation.capturedAt,
      areaM2: detection.areaM2,
      confidence: detection.confidence,
      densityLevel: detection.densityLevel,
      centroidLat: detection.centroid.lat,
      centroidLng: detection.centroid.lng,
      sourcePixelCount: detection.sourcePixelCount,
    },
  }
}

/**
 * Every exported detection as a FeatureCollection. `detections` is the exported subset (the map's
 * filtered list); the summary metrics always describe the whole observation.
 */
export function detectionsCollection(
  observation: Observation,
  options: { detections?: readonly Detection[]; hotspotCount: number; scope: ExportScope },
): DetectionCollection {
  const detections = options.detections ?? observation.detections
  return {
    type: 'FeatureCollection',
    observation: observationMember(
      observation,
      options.scope,
      detections.length,
      options.hotspotCount,
    ),
    features: detections.map((detection) => detectionFeature(detection, observation)),
  }
}

/** Corners of the hotspot's grid cells, [lng, lat]. */
function cellCorners(hotspot: Pick<Hotspot, 'cellIds'>, grid: DensityGrid | null): Position[] {
  if (!grid) return []
  const ids = new Set(hotspot.cellIds)
  return grid.cells
    .filter((cell) => ids.has(cell.id))
    .flatMap(({ bounds: b }) => [
      [b.west, b.south],
      [b.east, b.south],
      [b.east, b.north],
      [b.west, b.north],
    ])
}

/** A rectangle ring for bounds, counterclockwise and closed. */
function boundsRing(b: GeoBounds): Position[] {
  return [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ]
}

/**
 * Hotspots as polygons: the convex hull of their grid cells (falling back to the hotspot's
 * bounding box), ranked by priority.
 */
export function hotspotsCollection(
  observation: Observation,
  options: {
    hotspots: readonly Hotspot[]
    grid: DensityGrid | null
    scope: ExportScope
  },
): HotspotCollection {
  return {
    type: 'FeatureCollection',
    observation: observationMember(
      observation,
      options.scope,
      options.hotspots.length,
      options.hotspots.length,
    ),
    features: options.hotspots.map((hotspot) => ({
      type: 'Feature',
      id: hotspot.id,
      geometry: {
        type: 'Polygon',
        coordinates: [
          convexHullRing(cellCorners(hotspot, options.grid)) ?? boundsRing(hotspot.bounds),
        ],
      },
      properties: {
        id: hotspot.id,
        observationId: observation.id,
        rank: hotspot.rank,
        level: hotspot.level,
        totalAreaM2: hotspot.totalAreaM2,
        meanConfidence: hotspot.meanConfidence,
        priorityScore: hotspot.priorityScore,
        detectionCount: hotspot.detectionIds.length,
        centroidLat: hotspot.centroid.lat,
        centroidLng: hotspot.centroid.lng,
      },
    })),
  }
}

/** Pretty-printed, as people open these in text editors as often as in GIS tools. */
export function toGeoJsonText(collection: FeatureCollection | Feature): string {
  return `${JSON.stringify(collection, null, 2)}\n`
}
