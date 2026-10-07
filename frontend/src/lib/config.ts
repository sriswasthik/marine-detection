import type { ModelMetrics } from '@/features/observations/types'

/**
 * Density level thresholds: percent of a grid cell's area covered by debris.
 *
 * PLACEHOLDERS. These are reasonable starting values for a demo, not validated figures.
 * Replace them with thresholds calibrated on project data before presenting results as real.
 *
 * Low: below `moderate`. Moderate: from `moderate` up to `high`.
 * High: from `high` up to `critical`. Critical: `critical` and above.
 */
export const DENSITY_THRESHOLDS = {
  moderate: 2,
  high: 8,
  critical: 20,
} as const

/**
 * Detection confidence bands, 0 to 1. Used by ConfidenceBadge and the stats.
 * Low: below `low` (under 0.60). Medium: from `low` up to `high` (0.60 to 0.79).
 * High: `high` and above (0.80 or more).
 */
export const CONFIDENCE_THRESHOLDS = {
  low: 0.6,
  high: 0.8,
} as const

/** Grid cell edge in meters at the reference resolution (Sentinel-2, 10 m per pixel). */
export const GRID_CELL_SIZE_M = 250
export const REFERENCE_RESOLUTION_M = 10

/**
 * Grid cell edge for a given image resolution. The cell always spans the same number of
 * pixels (25 x 25), so a 0.1 m drone image uses 2.5 m cells. Unknown resolution uses the default.
 */
export function gridCellSizeForResolution(resolutionM: number | null | undefined): number {
  if (resolutionM === null || resolutionM === undefined || !(resolutionM > 0)) {
    return GRID_CELL_SIZE_M
  }
  return (GRID_CELL_SIZE_M / REFERENCE_RESOLUTION_M) * resolutionM
}

/** The model behind the detections. Edit here; every screen and the mock read from this. */
export const MODEL_CARD = {
  name: 'UNet++ marine debris segmentation',
  shortName: 'UNet++',
  version: '0.1.0',
  architecture: 'UNet++ semantic segmentation',
  trainingData: 'MARIDA (Sentinel-2)',
} as const

/**
 * Placeholder evaluation figures. The UI must label these "Sample values" while
 * `isPlaceholder` is true. Replace with the project's evaluation results.
 */
export const PLACEHOLDER_MODEL_METRICS: ModelMetrics = {
  precision: 0.81,
  recall: 0.74,
  f1: 0.77,
  accuracy: 0.93,
  benchmark: 'Placeholder values, replace with project evaluation results',
  isPlaceholder: true,
}

export const MAX_UPLOAD_MB = 100
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

/** Accepted upload MIME types and their file extensions. */
export const ACCEPTED_TYPES = {
  'image/tiff': ['.tif', '.tiff'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
} as const satisfies Record<string, readonly string[]>

export const ACCEPTED_EXTENSIONS: readonly string[] = Object.values(ACCEPTED_TYPES).flat()
