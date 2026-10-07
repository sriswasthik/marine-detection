/**
 * Text for the printed one-page report: method and caveats, and attributions. Pure, so the wording
 * can be checked without rendering.
 */
import type { ObservationSource } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS, DENSITY_THRESHOLDS, MODEL_CARD } from '@/lib/config'
import { formatConfidence, formatLength } from '@/lib/format'
import { BASEMAPS, type BasemapId } from '@/lib/map/basemaps'

/** Hotspots listed in the report table. */
export const REPORT_TOP_HOTSPOTS = 5

const percent = (value: number) => `${value}%`

/**
 * "Method and caveats": the model, what confidence means, how density levels are set (and that the
 * thresholds are configurable), and the sample-data disclaimer. The result's own caveats are
 * listed separately at the top of the report.
 */
export function methodAndCaveats(options: { sampleData: boolean; cellSizeM: number }): string[] {
  const t = DENSITY_THRESHOLDS
  const sentences = [
    `Detections come from ${MODEL_CARD.name} ${MODEL_CARD.version}, a ${MODEL_CARD.architecture} model trained on ${MODEL_CARD.trainingData}.`,
    `Confidence is the model's certainty that a region is floating debris: ${formatConfidence(CONFIDENCE_THRESHOLDS.high)} or more is high, below ${formatConfidence(CONFIDENCE_THRESHOLDS.low)} is low and worth checking against the image.`,
    `Density levels grade the share of each ${formatLength(options.cellSizeM)} grid cell covered by debris (Moderate from ${percent(t.moderate)}, High from ${percent(t.high)}, Critical from ${percent(t.critical)}); these thresholds are configurable placeholders, not calibrated values.`,
  ]
  if (options.sampleData) {
    sentences.push(
      'Sample data: this report was produced from synthetic sample data for demonstration. It does not describe a real observation.',
    )
  }
  return sentences
}

/**
 * Who to credit: the basemap's sources, the model's training data, and the source imagery when it
 * is a real Sentinel-2 scene (sample scenes contain no satellite imagery).
 */
export function reportAttributions(options: {
  basemap: BasemapId
  source: ObservationSource
  sampleData: boolean
  capturedAt: string
}): string[] {
  const year = new Date(options.capturedAt).getUTCFullYear()
  return [
    `Basemap: ${BASEMAPS[options.basemap].credit}.`,
    `Model training data: MARIDA, derived from Copernicus Sentinel-2 imagery.`,
    ...(options.source === 'satellite' && !options.sampleData && Number.isFinite(year)
      ? [`Source image: contains modified Copernicus Sentinel-2 data ${year}.`]
      : []),
  ]
}
