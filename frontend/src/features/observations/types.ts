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
  'STRIPE_ARTEFACT',
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
  /** Debris-class IoU, and scene-wide mean IoU and macro F1, when the evaluation reports them. */
  iou?: number
  meanIoU?: number
  macroF1?: number
}

export interface ProcessingInfo {
  startedAt: string
  finishedAt: string
  modelName: string
  modelVersion: string
  /** Where the model ran, for example "cpu". */
  device?: string
  /** Time spent per pipeline stage, ms. */
  stagesMs?: Record<string, number>
}

export const MARIDA_SPLITS = ['train', 'val', 'test'] as const
export type MaridaSplit = (typeof MARIDA_SPLITS)[number]

/** The MARIDA patch a real model output was computed on. Its presence means "not synthetic". */
export interface MaridaPatch {
  id: string
  tile: string
  /** Capture date, YYYY-MM-DD. MARIDA names carry no time of day. */
  date: string
  /** The dataset split the patch belongs to. Training patches were seen by the model. */
  split: MaridaSplit | null
}

/** Share of valid pixels per context class, in percent, from the model's class map. */
export interface SceneContext {
  validPixels: number
  debrisPercent: number
  cloudPercent: number
  shipPercent: number
  foamPercent: number
  sargassumPercent: number
  naturalOrganicPercent: number
  classPixelCounts: Record<string, number>
}

/**
 * A debris-class region the service left out of the detections. `stripe`: a thin band along the
 * image rows or columns; the model draws these near patch edges, and floating debris does not
 * follow the pixel grid.
 */
export interface SuppressedRegion {
  reason: 'stripe'
  pixels: number
  areaM2: number
  confidence: number
  rowSpan: number
  colSpan: number
  firstRow: number
  firstCol: number
}

/** Colour of one model class in the classes overlay (maskUrl), so a legend can match it. */
export interface ClassPaletteEntry {
  id: number
  name: string
  /** Hex colour, or null for classes that are not drawn (the water classes). */
  color: string | null
  opacity: number
  drawn: boolean
}

/** Percent of a grid cell's area covered by debris at which each level starts. */
export interface DensityThresholds {
  moderate: number
  high: number
  critical: number
}

/** A grid cell holding debris, as the service measured it from the model's pixels. */
export interface ServiceDensityCell {
  /** `r{row}c{col}`, row 0 at the south edge, column 0 at the west edge. */
  id: string
  row: number
  col: number
  bounds: GeoBounds
  /** Imaged area of the cell, square meters (edge cells and no-data pixels make it smaller). */
  areaM2: number
  debrisAreaM2: number
  coveragePercent: number
  level: DensityLevel
  /** Debris area of each detection inside the cell, square meters, by detection id. */
  detectionAreasM2: Record<string, number>
}

/**
 * The density grid the service computed (backend/pipeline.py compute_density). Only cells holding
 * debris are listed; the rest of the rows x cols grid is empty.
 */
export interface ServiceDensityGrid {
  /** How the cells were measured, in words. */
  method: string
  cellSizeM: number
  /** Cell edge in source image pixels. */
  cellSizePx?: number
  rows: number
  cols: number
  thresholds: DensityThresholds
  cells: ServiceDensityCell[]
}

/** A cluster of adjacent dense grid cells worth inspecting, ranked by priority. */
export interface Hotspot {
  /** `hotspot-{rank}`. */
  id: string
  /** 1 is the highest priority. */
  rank: number
  /** Highest level among the hotspot's cells. */
  level: DensityLevel
  bounds: GeoBounds
  /** Debris-area-weighted centre of the hotspot's cells. */
  centroid: LatLng
  cellIds: string[]
  /** Detections with any area inside the hotspot's cells. */
  detectionIds: string[]
  /** Debris area inside the hotspot's cells, square meters. */
  totalAreaM2: number
  /** Mean confidence of the hotspot's detections, 0 to 1. */
  meanConfidence: number
  /** totalAreaM2 × meanConfidence × the level weight (see HOTSPOT_LEVEL_WEIGHTS). */
  priorityScore: number
}

/**
 * Raster facts and debris figures measured by the service on the source image (backend/pipeline.py
 * geospatial_summary). Debris figures count the kept detections only, like debrisAreaM2.
 */
export interface GeospatialSummary {
  width: number
  height: number
  bandCount: number
  /** Data type of the bands in the file, for example "float32". */
  dataType: string
  /** For example "EPSG:32616". */
  crs: string
  /** The CRS's own name, for example "WGS 84 / UTM zone 16N". */
  crsName: string
  /** Pixel size in the CRS's units (pixelSizeUnit). */
  pixelSizeX: number
  pixelSizeY: number
  pixelSizeUnit: string
  pixelAreaM2: number
  totalPixels: number
  validPixels: number
  /** Area of the whole image, every pixel, square meters. */
  sceneAreaM2: number
  debrisPixels: number
  debrisAreaM2: number
  /** Debris area over the whole scene area, percent. coveragePercent is over the water area. */
  debrisCoveragePercent: number
  /** Mean position of the debris pixel centres. Null when no debris was detected. */
  debrisCentroid: LatLng | null
  sceneCentre: LatLng
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
  /** Present on real model output for a MARIDA patch. */
  maridaPatch?: MaridaPatch
  sceneContext?: SceneContext
  classPalette?: ClassPaletteEntry[]
  /** Ground-truth debris overlay and pixel count, when the patch has MARIDA labels. */
  referenceUrl?: string
  referenceDebrisPixels?: number
  /** How waterAreaM2 was measured. */
  waterAreaDefinition?: string
  /** Debris-class regions left out of `detections`, with the reason (warning STRIPE_ARTEFACT). */
  suppressedRegions?: SuppressedRegion[]
  /**
   * Density grid and ranked hotspots measured by the service. Absent on synthetic sample data,
   * whose grid and hotspots are computed in the browser (src/lib/analysis.ts).
   */
  densityGrid?: ServiceDensityGrid
  hotspots?: Hotspot[]
  /** Raster facts and debris figures from the service. Absent on synthetic sample data. */
  geospatial?: GeospatialSummary
  /** The predicted class map as a GeoTIFF in the source CRS, for QGIS. */
  segmentationUrl?: string
  /** The class map as a PNG on the source pixel grid, in the QGIS style's colours. */
  segmentationPreviewUrl?: string
  /** True colour on the source pixel grid, pixel for pixel with segmentationPreviewUrl. */
  sceneImageUrl?: string
}

/**
 * List endpoint shape: everything except the detection geometries and the density grid (its
 * cells list detection ids), plus the detection count.
 */
export type ObservationSummary = Omit<Observation, 'detections' | 'densityGrid'> & {
  detectionCount: number
}

// ---------------------------------------------------------------------------
// Phase 3 — Analyst Review, Monitoring Areas, and Temporal Comparison
// ---------------------------------------------------------------------------

export const ANALYST_REVIEW_STATES = ['unreviewed', 'confirmed', 'false_positive', 'uncertain'] as const
export type AnalystReviewState = (typeof ANALYST_REVIEW_STATES)[number]

export interface AnalystReviewRecord {
  id: string
  observationId: string
  detectionId?: string
  status: AnalystReviewState
  notes?: string
  reviewerId?: string
  createdAt: string
  updatedAt: string
  provenance?: Record<string, unknown>
}

export interface ReviewSummary {
  total: number
  unreviewed: number
  confirmed: number
  falsePositive: number
  uncertain: number
}

export interface MonitoringArea {
  id: string
  name: string
  description?: string
  geometry: Polygon | MultiPolygon
  crs: string
  createdAt: string
  updatedAt: string
  purpose?: string
  status: 'active' | 'archived'
  areaM2: number
}

export interface IntersectingObservationSummary {
  observationId: string
  capturedAt: string
  region: string
  debrisAreaM2InArea: number
  totalObservationDebrisAreaM2: number
  detectionCountInArea: number
  coveragePercent: number
  reviewStatusSummary: Record<string, number>
}

export interface MonitoringAreaDetail extends MonitoringArea {
  intersectingObservations: IntersectingObservationSummary[]
}

export interface ComparabilityInfo {
  status: 'directly_comparable' | 'comparable_with_warnings' | 'incompatible'
  warnings: string[]
}

export interface SpatialMatch {
  baselineDetectionId?: string
  comparisonDetectionId?: string
  iou: number
  matchType: 'overlapping' | 'newly_detected' | 'not_detected_in_later' | 'geometric_change'
}

export interface TemporalComparisonResult {
  baselineObservationId: string
  comparisonObservationId: string
  comparability: ComparabilityInfo
  baselineDebrisAreaM2: number
  comparisonDebrisAreaM2: number
  areaDifferenceM2: number
  percentChange: number | null
  baselineDetectionCount: number
  comparisonDetectionCount: number
  baselineHotspotCount: number
  comparisonHotspotCount: number
  spatialMatches: SpatialMatch[]
  changeLayerGeoJSON?: Record<string, unknown>
  timestamp: string
}

