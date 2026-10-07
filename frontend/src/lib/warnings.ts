import type { Observation, ObservationWarning } from '@/features/observations/types'
import { formatCoveragePercent } from './format'

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
      detail: 'Many detections are uncertain. Check them against the image before acting.',
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
