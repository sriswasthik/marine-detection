import type { MultiPolygon, Polygon } from 'geojson'

export const OBSERVATION_SOURCES = ['satellite', 'drone'] as const
export type ObservationSource = (typeof OBSERVATION_SOURCES)[number]

export const OBSERVATION_STATUSES = [
  'queued',
  'processing',
  'completed',
  'partial',
  'failed',
] as const
export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number]

/** Ordered from least to most severe. Labels and colours live in src/lib/density.ts. */
export const DENSITY_LEVEL_IDS = ['low', 'moderate', 'high', 'critical'] as const
export type DensityLevel = (typeof DENSITY_LEVEL_IDS)[number]

export const OBSERVATION_WARNINGS = [
  'LOW_CONFIDENCE',
  'PARTIAL_GEOREF',
  'HIGH_CLOUD',
  'LOW_RESOLUTION',
] as const
export type ObservationWarning = (typeof OBSERVATION_WARNINGS)[number]

export interface LatLng {
  lat: number
  lng: number
}

/** Geographic bounds in WGS84 decimal degrees. */
export interface GeoBounds {
  north: number
  south: number
  east: number
  west: number
}

/** GeoJSON geometry, coordinates in [lng, lat] order. */
export type DetectionGeometry = Polygon | MultiPolygon

/** One debris region found by the model. */
export interface Detection {
  id: string
  geometry: DetectionGeometry
  areaM2: number
  /** Model confidence, 0 to 1. */
  confidence: number
  densityLevel: DensityLevel
  centroid: LatLng
  sourcePixelCount: number
}

export interface ModelMetrics {
  precision: number
  recall: number
  f1: number
  accuracy: number
  /** Where the figures come from, shown next to them in the UI. */
  benchmark: string
  /** True while the figures are not real evaluation results. The UI labels them "Sample values". */
  isPlaceholder: boolean
}

export interface ProcessingInfo {
  startedAt: string
  finishedAt: string
  modelName: string
  modelVersion: string
}

/** One processed image. */
export interface Observation {
  id: string
  name?: string
  source: ObservationSource
  /** ISO 8601 timestamp of image capture. */
  capturedAt: string
  region: string
  imageUrl: string
  previewUrl: string
  maskUrl?: string
  /** Null when the image could not be placed on the map. */
  bounds: GeoBounds | null
  /** Source coordinate reference system. Null means partial georeferencing. */
  crs: string | null
  status: ObservationStatus
  debrisAreaM2: number
  waterAreaM2: number
  coveragePercent: number
  /** Mean detection confidence, 0 to 1. Null when there are no detections. */
  averageConfidence: number | null
  /** Highest density level among grid cells with debris. Null when no debris was detected. */
  densityLevel: DensityLevel | null
  detections: Detection[]
  /** Evaluation figures for the model. Absent when the service has none to report. */
  modelMetrics?: ModelMetrics
  warnings?: ObservationWarning[]
  cloudCoveragePercent?: number
  /** Ground sample distance in meters per pixel. */
  resolutionM?: number
  processing?: ProcessingInfo
}

/** List endpoint shape: everything except the detection geometries, plus their count. */
export type ObservationSummary = Omit<Observation, 'detections'> & {
  detectionCount: number
}
