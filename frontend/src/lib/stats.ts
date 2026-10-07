import type { DensityLevel, Detection } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import { DENSITY_LEVEL_ORDER } from '@/lib/density'
import type { Hotspot } from '@/lib/hotspots'

export type ConfidenceBand = 'low' | 'medium' | 'high'
export const CONFIDENCE_BANDS: readonly ConfidenceBand[] = ['low', 'medium', 'high']

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high'
  if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'medium'
  return 'low'
}

export interface LevelBreakdown {
  level: DensityLevel
  detectionCount: number
  areaM2: number
  /** Share of total debris area, 0 to 1. Zero when there is no debris. */
  areaShare: number
}

export interface BandCount {
  count: number
  /** Share of detections, 0 to 1. Zero when there are no detections. */
  share: number
}

export interface ConfidenceDistribution {
  /** Null when there are no detections. */
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
  bands: Record<ConfidenceBand, BandCount>
}

export interface ObservationStats {
  hasDebris: boolean
  detectionCount: number
  hotspotCount: number
  totalDebrisAreaM2: number
  meanDetectionAreaM2: number | null
  largestDetectionAreaM2: number | null
  /** One entry per density level, Low to Critical. */
  byLevel: LevelBreakdown[]
  confidence: ConfidenceDistribution
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid]
  const lower = sorted[mid - 1]
  if (upper === undefined) return null
  return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

/** Derived figures for one observation. Safe for zero detections: never returns NaN. */
export function computeObservationStats(
  detections: readonly Detection[],
  hotspots: readonly Hotspot[] = [],
): ObservationStats {
  const count = detections.length
  const totalDebrisAreaM2 = detections.reduce((sum, d) => sum + d.areaM2, 0)

  const byLevel: LevelBreakdown[] = DENSITY_LEVEL_ORDER.map((level) => {
    const atLevel = detections.filter((d) => d.densityLevel === level)
    const areaM2 = atLevel.reduce((sum, d) => sum + d.areaM2, 0)
    return {
      level,
      detectionCount: atLevel.length,
      areaM2,
      areaShare: share(areaM2, totalDebrisAreaM2),
    }
  })

  const confidences = detections.map((d) => d.confidence).sort((a, b) => a - b)
  const bandCounts: Record<ConfidenceBand, number> = { low: 0, medium: 0, high: 0 }
  for (const c of confidences) bandCounts[confidenceBand(c)] += 1

  return {
    hasDebris: count > 0,
    detectionCount: count,
    hotspotCount: hotspots.length,
    totalDebrisAreaM2,
    meanDetectionAreaM2: count > 0 ? totalDebrisAreaM2 / count : null,
    largestDetectionAreaM2: count > 0 ? Math.max(...detections.map((d) => d.areaM2)) : null,
    byLevel,
    confidence: {
      mean: count > 0 ? confidences.reduce((a, b) => a + b, 0) / count : null,
      median: median(confidences),
      min: confidences[0] ?? null,
      max: confidences[confidences.length - 1] ?? null,
      bands: {
        low: { count: bandCounts.low, share: share(bandCounts.low, count) },
        medium: { count: bandCounts.medium, share: share(bandCounts.medium, count) },
        high: { count: bandCounts.high, share: share(bandCounts.high, count) },
      },
    },
  }
}
