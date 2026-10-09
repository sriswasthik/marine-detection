import type { Observation, ObservationSummary } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS } from './config'
import { DENSITY_LEVELS, maxDensityLevel } from './density'
import {
  EMPTY_VALUE,
  formatArea,
  formatConfidence,
  formatCoveragePercent,
  formatInteger,
} from './format'
import type { Hotspot } from './hotspots'

export type KpiId = 'debrisArea' | 'coverage' | 'hotspots' | 'confidence'

export interface Kpi {
  id: KpiId
  label: string
  /** Formatted value; never "NaN". */
  value: string
  unit?: string
  /** How the figure is computed, for the hint tooltip. */
  hint: string
  footnote: string
}

const plural = (count: number, one: string, many: string) =>
  `${formatInteger(count)} ${count === 1 ? one : many}`

/**
 * The four headline figures for one observation, already formatted. Safe for a no-debris
 * result: zeros for counts and areas, a dash for confidence (there is nothing to average).
 */
export function observationKpis(
  observation: Pick<
    Observation,
    'debrisAreaM2' | 'waterAreaM2' | 'coveragePercent' | 'averageConfidence' | 'detections'
  >,
  hotspots: readonly Pick<Hotspot, 'level'>[],
): Kpi[] {
  const count = observation.detections.length
  const lowConfidence = observation.detections.filter(
    (d) => d.confidence < CONFIDENCE_THRESHOLDS.low,
  ).length
  const topLevel = maxDensityLevel(hotspots.map((h) => h.level))

  return [
    {
      id: 'debrisArea',
      label: 'Debris area',
      value: formatArea(observation.debrisAreaM2),
      hint: 'Sum of the areas of every detection, measured from its outline on the map.',
      footnote: count > 0 ? plural(count, 'detection', 'detections') : 'No detections',
    },
    {
      id: 'coverage',
      label: 'Coverage',
      value: formatCoveragePercent(observation.coveragePercent),
      hint: 'Coverage = detected debris area / water area in the analysed footprint.',
      footnote: `of ${formatArea(observation.waterAreaM2)} water`,
    },
    {
      id: 'hotspots',
      label: 'Hotspots',
      value: formatInteger(hotspots.length),
      hint: 'Clusters of neighbouring grid cells at High or Critical density, or Moderate when nothing is higher. Each one is worth an inspection.',
      footnote: topLevel ? `Highest level: ${DENSITY_LEVELS[topLevel].label}` : 'None stands out',
    },
    {
      id: 'confidence',
      label: 'Average confidence',
      value:
        observation.averageConfidence === null
          ? EMPTY_VALUE
          : formatConfidence(observation.averageConfidence),
      hint: 'Mean model confidence across all detections in this observation.',
      footnote:
        count === 0
          ? 'No detections to average'
          : `${formatInteger(lowConfidence)} below ${formatConfidence(CONFIDENCE_THRESHOLDS.low)}`,
    },
  ]
}

export interface FleetSummary {
  observations: number
  /** Possible debris regions across every observation. */
  detections: number
  /** Observations where the model found possible debris. */
  withDebris: number
  /** Total debris area across every observation, square meters. */
  debrisAreaM2: number
}

/** Figures across all observations on record, for the Overview hero. */
export function fleetSummary(
  observations: readonly Pick<ObservationSummary, 'detectionCount' | 'debrisAreaM2'>[],
): FleetSummary {
  let detections = 0
  let withDebris = 0
  let debrisAreaM2 = 0
  for (const observation of observations) {
    const count = Math.max(0, observation.detectionCount)
    detections += count
    if (count > 0) withDebris += 1
    if (Number.isFinite(observation.debrisAreaM2)) debrisAreaM2 += observation.debrisAreaM2
  }
  return { observations: observations.length, detections, withDebris, debrisAreaM2 }
}
