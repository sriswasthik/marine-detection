import type { Observation, ObservationWarning } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS } from './config'
import { formatConfidence, formatCoveragePercent } from './format'

export interface WarningMessage {
  code: ObservationWarning
  title: string
  detail: string
}

/**
 * Plain-language reading of an observation's warnings: what is affected and what to do.
 * Unknown codes are ignored; the order follows the observation's own list.
 */
export function describeWarnings(
  observation: Pick<Observation, 'warnings' | 'cloudCoveragePercent' | 'resolutionM'>,
): WarningMessage[] {
  const messages: Record<ObservationWarning, () => Omit<WarningMessage, 'code'>> = {
    LOW_CONFIDENCE: () => ({
      title: 'Low confidence',
      detail:
        'Many detections are uncertain, so check them against the image before acting on them.',
    }),
    PARTIAL_GEOREF: () => ({
      title: 'Approximate positions',
      detail:
        'The image had no coordinate reference system, so positions may be off by a few hundred meters.',
    }),
    HIGH_CLOUD: () => ({
      title: 'Cloud cover',
      detail:
        observation.cloudCoveragePercent !== undefined
          ? `Cloud covered ${formatCoveragePercent(observation.cloudCoveragePercent)} of the image, so some debris may be hidden.`
          : 'Clouds covered part of the image, so some debris may be hidden.',
    }),
    LOW_RESOLUTION: () => ({
      title: 'Coarse resolution',
      detail: 'Small debris may be missed at this image resolution.',
    }),
  }
  return [...new Set(observation.warnings ?? [])].map((code) => ({ code, ...messages[code]() }))
}

/**
 * The low-confidence rule, used everywhere a result is shown: the average confidence is below the
 * low threshold, or the service flagged the result with LOW_CONFIDENCE.
 */
export function isLowConfidenceResult(
  observation: Pick<Observation, 'averageConfidence' | 'warnings'>,
): boolean {
  const average = observation.averageConfidence
  return (
    (average !== null && Number.isFinite(average) && average < CONFIDENCE_THRESHOLDS.low) ||
    (observation.warnings ?? []).includes('LOW_CONFIDENCE')
  )
}

/**
 * Partial success: detections are available but the geospatial metadata is incomplete
 * (no coordinate reference system, no image bounds, or the service says positions are approximate).
 */
export function hasApproximatePositions(
  observation: Pick<Observation, 'crs' | 'bounds' | 'warnings'>,
): boolean {
  return (
    observation.crs === null ||
    observation.bounds === null ||
    (observation.warnings ?? []).includes('PARTIAL_GEOREF')
  )
}

export type NoticeId =
  'low-confidence' | 'approximate-positions' | 'partial-data' | 'cloud-cover' | 'coarse-resolution'

export interface ObservationNotice {
  id: NoticeId
  title: string
  /** One sentence: how this affects the results and what to do about it. */
  message: string
}

/**
 * Every caveat to show with a result, most important first. Each surface shows all of them, or
 * the subset that affects what it draws (see `only`).
 */
export function observationNotices(
  observation: Pick<
    Observation,
    'averageConfidence' | 'warnings' | 'crs' | 'bounds' | 'cloudCoveragePercent' | 'resolutionM'
  > & { detections: readonly unknown[] },
  options: { partialData?: boolean; only?: readonly NoticeId[] } = {},
): ObservationNotice[] {
  const notices: ObservationNotice[] = []
  const hasDetections = observation.detections.length > 0
  const warnings = describeWarnings(observation)
  const warning = (code: ObservationWarning) => warnings.find((w) => w.code === code)

  if (hasDetections && isLowConfidenceResult(observation)) {
    const average = observation.averageConfidence
    const threshold = formatConfidence(CONFIDENCE_THRESHOLDS.low)
    notices.push({
      id: 'low-confidence',
      title: 'Low confidence',
      message:
        average !== null && average < CONFIDENCE_THRESHOLDS.low
          ? `Average confidence is ${formatConfidence(average)}, below the ${threshold} threshold, so check the dashed, lighter regions against the image before acting on them.`
          : 'The model flagged this result as uncertain, so check the dashed, lighter regions against the image before acting on them.',
    })
  }
  if (hasApproximatePositions(observation)) {
    notices.push({
      id: 'approximate-positions',
      title: 'Approximate positions',
      message:
        observation.bounds === null
          ? 'The image could not be placed exactly, so positions are approximate while areas and counts, measured within the image, stay correct.'
          : 'The image had no coordinate reference system, so positions may be off by a few hundred meters while areas and counts stay correct.',
    })
  }
  if (options.partialData) {
    notices.push({
      id: 'partial-data',
      title: 'Partial data',
      message:
        'Some detections could not be read and are left out, so totals here may be slightly low.',
    })
  }
  const cloud = warning('HIGH_CLOUD')
  if (cloud) notices.push({ id: 'cloud-cover', title: cloud.title, message: cloud.detail })
  const resolution = warning('LOW_RESOLUTION')
  if (resolution) {
    notices.push({ id: 'coarse-resolution', title: resolution.title, message: resolution.detail })
  }
  return options.only ? notices.filter((n) => options.only?.includes(n.id)) : notices
}
