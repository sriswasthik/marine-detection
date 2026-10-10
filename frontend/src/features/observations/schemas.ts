import { z } from 'zod'
import {
  DENSITY_LEVEL_IDS,
  MARIDA_SPLITS,
  OBSERVATION_SOURCES,
  OBSERVATION_STATUSES,
  OBSERVATION_WARNINGS,
  type ClassPaletteEntry,
  type DensityThresholds,
  type GeoBounds,
  type GeospatialSummary,
  type Hotspot,
  type LatLng,
  type MaridaPatch,
  type ModelMetrics,
  type Observation,
  type ObservationSummary,
  type ProcessingInfo,
  type SceneContext,
  type ServiceDensityCell,
  type ServiceDensityGrid,
  type SuppressedRegion,
} from './types'
import { resolveDensityLevels, type UnresolvedDetection } from '@/lib/density'

const finite = z.number()
const nonNegative = finite.min(0)
const unitInterval = finite.min(0).max(1)
const percent = finite.min(0).max(100)
const isoDateTime = z.iso.datetime({ offset: true })

/** GeoJSON position [lng, lat] with an optional altitude. */
const PositionSchema = z
  .array(finite)
  .min(2)
  .max(3)
  .refine(([lng = NaN, lat = NaN]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: 'Position must be [lng, lat] within valid ranges',
  })

const LinearRingSchema = z
  .array(PositionSchema)
  .min(4, { message: 'A ring needs at least four positions' })
  .refine(
    (ring) => {
      const first = ring[0]
      const last = ring[ring.length - 1]
      return Boolean(first && last && first[0] === last[0] && first[1] === last[1])
    },
    { message: 'A ring must end where it starts' },
  )

const BBoxSchema = z.union([
  z.tuple([finite, finite, finite, finite]),
  z.tuple([finite, finite, finite, finite, finite, finite]),
])

export const PolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(LinearRingSchema).min(1),
  bbox: BBoxSchema.optional(),
})

export const MultiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(LinearRingSchema).min(1)).min(1),
  bbox: BBoxSchema.optional(),
})

export const DetectionGeometrySchema = z.discriminatedUnion('type', [
  PolygonSchema,
  MultiPolygonSchema,
])

export const LatLngSchema = z.object({
  lat: finite.min(-90).max(90),
  lng: finite.min(-180).max(180),
}) satisfies z.ZodType<LatLng>

export const GeoBoundsSchema = z
  .object({
    north: finite.min(-90).max(90),
    south: finite.min(-90).max(90),
    east: finite.min(-180).max(180),
    west: finite.min(-180).max(180),
  })
  .refine((b) => b.north > b.south, {
    message: 'North must be greater than south',
  }) satisfies z.ZodType<GeoBounds>

/**
 * A detection as the service sends it. The Python pipeline grades every detection; densityLevel
 * may still be null on observations stored before it did, and src/lib/density.ts fills those in
 * after parsing (see resolveDensityLevels).
 */
export const DetectionSchema = z.object({
  id: z.string().min(1),
  geometry: DetectionGeometrySchema,
  areaM2: nonNegative,
  confidence: unitInterval,
  densityLevel: z.enum(DENSITY_LEVEL_IDS).nullable(),
  centroid: LatLngSchema,
  sourcePixelCount: z.number().int().min(0),
}) satisfies z.ZodType<UnresolvedDetection>

export const ModelMetricsSchema = z.object({
  precision: unitInterval,
  recall: unitInterval,
  f1: unitInterval,
  accuracy: unitInterval,
  benchmark: z.string(),
  isPlaceholder: z.boolean(),
  iou: unitInterval.optional(),
  meanIoU: unitInterval.optional(),
  macroF1: unitInterval.optional(),
}) satisfies z.ZodType<ModelMetrics>

export const ProcessingInfoSchema = z.object({
  startedAt: isoDateTime,
  finishedAt: isoDateTime,
  modelName: z.string(),
  modelVersion: z.string(),
  device: z.string().optional(),
  stagesMs: z.record(z.string(), nonNegative).optional(),
}) satisfies z.ZodType<ProcessingInfo>

export const MaridaPatchSchema = z.object({
  id: z.string().min(1),
  tile: z.string(),
  date: z.iso.date(),
  split: z.enum(MARIDA_SPLITS).nullable(),
}) satisfies z.ZodType<MaridaPatch>

export const SceneContextSchema = z.object({
  validPixels: z.number().int().min(0),
  debrisPercent: percent,
  cloudPercent: percent,
  shipPercent: percent,
  foamPercent: percent,
  sargassumPercent: percent,
  naturalOrganicPercent: percent,
  classPixelCounts: z.record(z.string(), z.number().int().min(0)),
}) satisfies z.ZodType<SceneContext>

export const ClassPaletteEntrySchema = z.object({
  id: z.number().int().min(1),
  name: z.string(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  opacity: unitInterval,
  drawn: z.boolean(),
}) satisfies z.ZodType<ClassPaletteEntry>

export const SuppressedRegionSchema = z.object({
  reason: z.literal('stripe'),
  pixels: z.number().int().min(1),
  areaM2: nonNegative,
  confidence: unitInterval,
  rowSpan: z.number().int().min(1),
  colSpan: z.number().int().min(1),
  firstRow: z.number().int().min(0),
  firstCol: z.number().int().min(0),
}) satisfies z.ZodType<SuppressedRegion>

const DensityLevelSchema = z.enum(DENSITY_LEVEL_IDS)
const gridIndex = z.number().int().min(0)

export const DensityThresholdsSchema = z
  .object({ moderate: percent, high: percent, critical: percent })
  .refine((t) => t.moderate < t.high && t.high < t.critical, {
    message: 'Thresholds must rise from moderate to critical',
  }) satisfies z.ZodType<DensityThresholds>

export const ServiceDensityCellSchema = z.object({
  id: z.string().min(1),
  row: gridIndex,
  col: gridIndex,
  bounds: GeoBoundsSchema,
  areaM2: finite.positive(),
  debrisAreaM2: nonNegative,
  coveragePercent: percent,
  level: DensityLevelSchema,
  detectionAreasM2: z.record(z.string(), nonNegative),
}) satisfies z.ZodType<ServiceDensityCell>

export const ServiceDensityGridSchema = z
  .object({
    method: z.string(),
    cellSizeM: finite.positive(),
    cellSizePx: z.number().int().positive().optional(),
    rows: z.number().int().min(1),
    cols: z.number().int().min(1),
    thresholds: DensityThresholdsSchema,
    cells: z.array(ServiceDensityCellSchema),
  })
  .refine((g) => g.cells.every((c) => c.row < g.rows && c.col < g.cols), {
    message: 'Every cell must lie inside the grid',
  }) satisfies z.ZodType<ServiceDensityGrid>

export const HotspotSchema = z.object({
  id: z.string().min(1),
  rank: z.number().int().min(1),
  level: DensityLevelSchema,
  bounds: GeoBoundsSchema,
  centroid: LatLngSchema,
  cellIds: z.array(z.string()),
  detectionIds: z.array(z.string()),
  totalAreaM2: nonNegative,
  meanConfidence: unitInterval,
  priorityScore: nonNegative,
}) satisfies z.ZodType<Hotspot>

export const GeospatialSummarySchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  bandCount: z.number().int().min(1),
  dataType: z.string(),
  crs: z.string().min(1),
  crsName: z.string(),
  pixelSizeX: finite.positive(),
  pixelSizeY: finite.positive(),
  pixelSizeUnit: z.string(),
  pixelAreaM2: finite.positive(),
  totalPixels: z.number().int().min(1),
  validPixels: z.number().int().min(0),
  sceneAreaM2: finite.positive(),
  debrisPixels: z.number().int().min(0),
  debrisAreaM2: nonNegative,
  debrisCoveragePercent: percent,
  debrisCentroid: LatLngSchema.nullable(),
  sceneCentre: LatLngSchema,
}) satisfies z.ZodType<GeospatialSummary>

const observationFields = {
  id: z.string().min(1),
  name: z.string().optional(),
  source: z.enum(OBSERVATION_SOURCES),
  capturedAt: isoDateTime,
  region: z.string(),
  imageUrl: z.string(),
  previewUrl: z.string(),
  maskUrl: z.string().optional(),
  bounds: GeoBoundsSchema.nullable(),
  crs: z.string().min(1).nullable(),
  status: z.enum(OBSERVATION_STATUSES),
  debrisAreaM2: nonNegative,
  waterAreaM2: nonNegative,
  coveragePercent: percent,
  averageConfidence: unitInterval.nullable(),
  densityLevel: z.enum(DENSITY_LEVEL_IDS).nullable(),
  modelMetrics: ModelMetricsSchema.optional(),
  warnings: z.array(z.enum(OBSERVATION_WARNINGS)).optional(),
  cloudCoveragePercent: percent.optional(),
  resolutionM: finite.positive().optional(),
  processing: ProcessingInfoSchema.optional(),
  maridaPatch: MaridaPatchSchema.optional(),
  sceneContext: SceneContextSchema.optional(),
  classPalette: z.array(ClassPaletteEntrySchema).optional(),
  referenceUrl: z.string().optional(),
  referenceDebrisPixels: z.number().int().min(0).optional(),
  waterAreaDefinition: z.string().optional(),
  suppressedRegions: z.array(SuppressedRegionSchema).optional(),
  hotspots: z.array(HotspotSchema).optional(),
  geospatial: GeospatialSummarySchema.optional(),
  segmentationUrl: z.string().optional(),
  segmentationPreviewUrl: z.string().optional(),
  sceneImageUrl: z.string().optional(),
}

/** The wire shape. Detection density levels may still be null here; parseObservation fills them. */
export const ObservationSchema = z.object({
  ...observationFields,
  densityGrid: ServiceDensityGridSchema.optional(),
  detections: z.array(DetectionSchema),
})

export const ObservationSummarySchema = z.object({
  ...observationFields,
  detectionCount: z.number().int().min(0),
}) satisfies z.ZodType<ObservationSummary>

/** Observation fields with detections left unchecked, used to salvage partial data. */
const ObservationShellSchema = z.object({
  ...observationFields,
  densityGrid: ServiceDensityGridSchema.optional(),
  detections: z.array(z.unknown()),
})

// ---------------------------------------------------------------------------
// Parsing that reports instead of throwing
// ---------------------------------------------------------------------------

export interface ParseIssue {
  /** Dotted path to the field, for example "detections.3.confidence". Empty for the root. */
  path: string
  message: string
}

/**
 * valid: everything checked out.
 * partial: usable data, but some items were dropped; show a "partial data" notice with the issues.
 * invalid: nothing usable.
 */
export type ParseResult<T> =
  | { status: 'valid'; data: T; issues: [] }
  | { status: 'partial'; data: T; issues: ParseIssue[] }
  | { status: 'invalid'; data: null; issues: ParseIssue[] }

function toIssues(error: z.ZodError, prefix: readonly PropertyKey[] = []): ParseIssue[] {
  return error.issues.map((issue) => ({
    path: [...prefix, ...issue.path].map(String).join('.'),
    message: issue.message,
  }))
}

/**
 * Validates one observation. When the observation itself is sound but some detections are
 * malformed, those detections are dropped and the result is `partial`.
 */
export function parseObservation(input: unknown): ParseResult<Observation> {
  const full = ObservationSchema.safeParse(input)
  if (full.success) return { status: 'valid', data: resolveDensityLevels(full.data), issues: [] }

  const shell = ObservationShellSchema.safeParse(input)
  if (!shell.success) return { status: 'invalid', data: null, issues: toIssues(shell.error) }

  const issues: ParseIssue[] = []
  const detections: UnresolvedDetection[] = []
  shell.data.detections.forEach((raw, index) => {
    const parsed = DetectionSchema.safeParse(raw)
    if (parsed.success) detections.push(parsed.data)
    else issues.push(...toIssues(parsed.error, ['detections', index]))
  })
  return {
    status: 'partial',
    data: resolveDensityLevels({ ...shell.data, detections }),
    issues,
  }
}

/**
 * Validates a list of observation summaries. Malformed items are dropped and reported;
 * the result is `invalid` only when the input is not a list or no item is usable.
 */
export function parseObservationList(input: unknown): ParseResult<ObservationSummary[]> {
  if (!Array.isArray(input)) {
    return {
      status: 'invalid',
      data: null,
      issues: [{ path: '', message: 'Expected a list of observations' }],
    }
  }
  const items: ObservationSummary[] = []
  const issues: ParseIssue[] = []
  input.forEach((raw: unknown, index) => {
    const parsed = ObservationSummarySchema.safeParse(raw)
    if (parsed.success) items.push(parsed.data)
    else issues.push(...toIssues(parsed.error, [index]))
  })
  if (issues.length === 0) return { status: 'valid', data: items, issues: [] }
  if (items.length === 0) return { status: 'invalid', data: null, issues }
  return { status: 'partial', data: items, issues }
}

// ---------------------------------------------------------------------------
// Phase 3 Schemas
// ---------------------------------------------------------------------------

export const AnalystReviewStateSchema = z.enum(['unreviewed', 'confirmed', 'false_positive', 'uncertain'])

export const AnalystReviewRecordSchema = z.object({
  id: z.string().min(1),
  observationId: z.string().min(1),
  detectionId: z.string().optional(),
  status: AnalystReviewStateSchema,
  notes: z.string().optional(),
  reviewerId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  provenance: z.record(z.string(), z.unknown()).optional(),
})

export const ReviewSummarySchema = z.object({
  total: z.number().int().min(0),
  unreviewed: z.number().int().min(0),
  confirmed: z.number().int().min(0),
  falsePositive: z.number().int().min(0),
  uncertain: z.number().int().min(0),
})

export const MonitoringAreaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  geometry: DetectionGeometrySchema,
  crs: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  purpose: z.string().optional(),
  status: z.enum(['active', 'archived']),
  areaM2: z.number().min(0),
})

export const IntersectingObservationSummarySchema = z.object({
  observationId: z.string().min(1),
  capturedAt: z.string(),
  region: z.string(),
  debrisAreaM2InArea: z.number().min(0),
  totalObservationDebrisAreaM2: z.number().min(0),
  detectionCountInArea: z.number().int().min(0),
  coveragePercent: z.number().min(0).max(100),
  reviewStatusSummary: z.record(z.string(), z.number().int().min(0)),
})

export const MonitoringAreaDetailSchema = MonitoringAreaSchema.extend({
  intersectingObservations: z.array(IntersectingObservationSummarySchema),
})

export const ComparabilityInfoSchema = z.object({
  status: z.enum(['directly_comparable', 'comparable_with_warnings', 'incompatible']),
  warnings: z.array(z.string()),
})

export const SpatialMatchSchema = z.object({
  baselineDetectionId: z.string().optional(),
  comparisonDetectionId: z.string().optional(),
  iou: z.number().min(0).max(1),
  matchType: z.enum(['overlapping', 'newly_detected', 'not_detected_in_later', 'geometric_change']),
})

export const TemporalComparisonResultSchema = z.object({
  baselineObservationId: z.string().min(1),
  comparisonObservationId: z.string().min(1),
  comparability: ComparabilityInfoSchema,
  baselineDebrisAreaM2: z.number().min(0),
  comparisonDebrisAreaM2: z.number().min(0),
  areaDifferenceM2: z.number(),
  percentChange: z.number().nullable(),
  baselineDetectionCount: z.number().int().min(0),
  comparisonDetectionCount: z.number().int().min(0),
  baselineHotspotCount: z.number().int().min(0),
  comparisonHotspotCount: z.number().int().min(0),
  spatialMatches: z.array(SpatialMatchSchema),
  changeLayerGeoJSON: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
})

