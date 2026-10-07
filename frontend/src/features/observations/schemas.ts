import { z } from 'zod'
import {
  DENSITY_LEVEL_IDS,
  OBSERVATION_SOURCES,
  OBSERVATION_STATUSES,
  OBSERVATION_WARNINGS,
  type Detection,
  type GeoBounds,
  type LatLng,
  type ModelMetrics,
  type Observation,
  type ObservationSummary,
  type ProcessingInfo,
} from './types'

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

export const DetectionSchema = z.object({
  id: z.string().min(1),
  geometry: DetectionGeometrySchema,
  areaM2: nonNegative,
  confidence: unitInterval,
  densityLevel: z.enum(DENSITY_LEVEL_IDS),
  centroid: LatLngSchema,
  sourcePixelCount: z.number().int().min(0),
}) satisfies z.ZodType<Detection>

export const ModelMetricsSchema = z.object({
  precision: unitInterval,
  recall: unitInterval,
  f1: unitInterval,
  accuracy: unitInterval,
  benchmark: z.string(),
  isPlaceholder: z.boolean(),
}) satisfies z.ZodType<ModelMetrics>

export const ProcessingInfoSchema = z.object({
  startedAt: isoDateTime,
  finishedAt: isoDateTime,
  modelName: z.string(),
  modelVersion: z.string(),
}) satisfies z.ZodType<ProcessingInfo>

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
}

export const ObservationSchema = z.object({
  ...observationFields,
  detections: z.array(DetectionSchema),
}) satisfies z.ZodType<Observation>

export const ObservationSummarySchema = z.object({
  ...observationFields,
  detectionCount: z.number().int().min(0),
}) satisfies z.ZodType<ObservationSummary>

/** Observation fields with detections left unchecked, used to salvage partial data. */
const ObservationShellSchema = z.object({
  ...observationFields,
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
  if (full.success) return { status: 'valid', data: full.data, issues: [] }

  const shell = ObservationShellSchema.safeParse(input)
  if (!shell.success) return { status: 'invalid', data: null, issues: toIssues(shell.error) }

  const issues: ParseIssue[] = []
  const detections: Detection[] = []
  shell.data.detections.forEach((raw, index) => {
    const parsed = DetectionSchema.safeParse(raw)
    if (parsed.success) detections.push(parsed.data)
    else issues.push(...toIssues(parsed.error, ['detections', index]))
  })
  return { status: 'partial', data: { ...shell.data, detections }, issues }
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
