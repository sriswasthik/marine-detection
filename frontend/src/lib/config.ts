import type { JobStep } from '@/features/observations/api/types'
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
 * pixels (25 x 25), so a 20 m image would use 500 m cells. Unknown resolution uses the default.
 */
export function gridCellSizeForResolution(resolutionM: number | null | undefined): number {
  if (resolutionM === null || resolutionM === undefined || !(resolutionM > 0)) {
    return GRID_CELL_SIZE_M
  }
  return (GRID_CELL_SIZE_M / REFERENCE_RESOLUTION_M) * resolutionM
}

/** The model behind the detections. Edit here; every screen and the mock read from this. */
export const MODEL_CARD = {
  name: 'U-Net marine debris segmentation',
  shortName: 'U-Net',
  version: '0.1.0',
  architecture: 'U-Net semantic segmentation',
  trainingData: 'MARIDA (Sentinel-2)',
  evaluationData: 'MARIDA test split (placeholder figures until the project evaluation is run)',
  /** Where the model is known to struggle, from the problem statement. Shown on the model card. */
  limitations: [
    'Clouds and cloud shadow can hide debris, or be mistaken for it at their edges.',
    'Sun-glint, the mirror-like reflection of the sun off the sea, can look like bright floating material.',
    'Sea foam and whitecaps can be confused with debris, especially in rough water.',
    'Floating algae such as Sargassum and other natural matter look similar to plastic in the image bands.',
    'Turbid, sediment-laden water near river mouths lowers contrast, so confidence drops.',
    'At 10 m per pixel, items smaller than a pixel are only seen when they gather in patches or windrows.',
  ],
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

/**
 * What the model reads: one Sentinel-2 GeoTIFF holding these bands in this order (MARIDA:
 * B1 to B8A, B11 and B12). PNG, JPEG, drone imagery and other band counts are refused up front.
 */
export const MODEL_INPUT = {
  bands: 11,
  wavelengthsNm: [440, 490, 560, 665, 705, 740, 783, 842, 865, 1600, 2200],
  /** Zero-based band indexes of a true-colour preview: 665, 560 and 490 nm. */
  trueColourBands: [3, 2, 1],
} as const

/** Accepted upload MIME types and their file extensions. */
export const ACCEPTED_TYPES = {
  'image/tiff': ['.tif', '.tiff'],
} as const satisfies Record<string, readonly string[]>

export const ACCEPTED_EXTENSIONS: readonly string[] = Object.values(ACCEPTED_TYPES).flat()

/** Smallest image side accepted for analysis, in pixels. */
export const MIN_IMAGE_PX = 128

/** Resolution bands for the quality check, meters per pixel. Coarser images miss small debris. */
export const RESOLUTION_LIMITS_M = {
  /** At or below: fine for floating debris (Sentinel-2 is 10 m). */
  good: 10,
  /** Above good and up to this: usable with a warning. Beyond it: too coarse to analyse. */
  usable: 60,
} as const

/** Step names and one-line descriptions for the processing stepper. */
export const PIPELINE_STEP_COPY: Readonly<Record<JobStep, { label: string; description: string }>> =
  {
    upload: { label: 'Upload', description: 'Sending the image to the processing service' },
    preprocess: {
      label: 'Preprocess',
      description: 'Normalising bands and masking cloud and sun-glint',
    },
    detect: { label: 'Detect', description: `Running ${MODEL_CARD.name}` },
    map: { label: 'Map', description: 'Converting pixel regions to geographic polygons' },
  }

/** Time limit for reads and job polling. A request that takes longer fails with TIMEOUT. */
export const REQUEST_TIMEOUT_MS = 20_000

/** Time limit for an image upload. */
export const UPLOAD_TIMEOUT_MS = 300_000
