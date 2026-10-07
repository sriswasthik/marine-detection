import {
  DENSITY_LEVEL_IDS,
  type DensityLevel,
  type Detection,
  type Observation,
  type ObservationSource,
  type ObservationSummary,
} from '@/features/observations/types'

export type SourceFilter = 'all' | ObservationSource

export interface MapFilters {
  source: SourceFilter
  /** Inclusive capture date range, YYYY-MM-DD (UTC). Null means open-ended. */
  dateFrom: string | null
  dateTo: string | null
  /** Minimum detection confidence, 0 to 1. 0 shows everything. */
  minConfidence: number
  /** Density levels to show. All four by default; empty shows no detections. */
  levels: readonly DensityLevel[]
  /** Region group (see regionGroup). Null means every region. */
  region: string | null
}

export const DEFAULT_FILTERS: MapFilters = {
  source: 'all',
  dateFrom: null,
  dateTo: null,
  minConfidence: 0,
  levels: DENSITY_LEVEL_IDS,
  region: null,
}

/**
 * The broader region an observation belongs to: the part after the last comma
 * ("Ennore coast, Bay of Bengal" -> "Bay of Bengal"), or the whole name.
 */
export function regionGroup(region: string): string {
  const parts = region
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts[parts.length - 1] ?? region.trim()
}

/** Distinct region groups, sorted alphabetically. */
export function regionGroups(
  observations: readonly Pick<ObservationSummary, 'region'>[],
): string[] {
  return [...new Set(observations.map((o) => regionGroup(o.region)))].sort((a, b) =>
    a.localeCompare(b),
  )
}

const levelsAreAll = (levels: readonly DensityLevel[]) =>
  DENSITY_LEVEL_IDS.every((level) => levels.includes(level))

export function hasActiveFilters(filters: MapFilters): boolean {
  return activeFilterCount(filters) > 0
}

/** Number of filter dimensions that differ from the defaults (date range counts once). */
export function activeFilterCount(filters: MapFilters): number {
  return [
    filters.source !== 'all',
    filters.dateFrom !== null || filters.dateTo !== null,
    filters.minConfidence > 0,
    !levelsAreAll(filters.levels),
    filters.region !== null,
  ].filter(Boolean).length
}

/** UTC calendar date of an ISO timestamp, YYYY-MM-DD. */
function captureDate(capturedAt: string): string {
  return new Date(capturedAt).toISOString().slice(0, 10)
}

/** Observation-level filters: source, capture date range and region. */
export function observationMatchesFilters(
  observation: Pick<ObservationSummary, 'source' | 'capturedAt' | 'region'>,
  filters: MapFilters,
): boolean {
  if (filters.source !== 'all' && observation.source !== filters.source) return false
  const date = captureDate(observation.capturedAt)
  if (filters.dateFrom && date < filters.dateFrom) return false
  if (filters.dateTo && date > filters.dateTo) return false
  if (filters.region && regionGroup(observation.region) !== filters.region) return false
  return true
}

export function filterObservations<
  T extends Pick<ObservationSummary, 'source' | 'capturedAt' | 'region'>,
>(observations: readonly T[], filters: MapFilters): T[] {
  return observations.filter((o) => observationMatchesFilters(o, filters))
}

/** Detection-level filters: minimum confidence and density levels. */
export function filterDetections(
  detections: readonly Detection[],
  filters: Pick<MapFilters, 'minConfidence' | 'levels'>,
): Detection[] {
  const levels = new Set(filters.levels)
  return detections.filter(
    (d) => d.confidence >= filters.minConfidence && levels.has(d.densityLevel),
  )
}

export interface FilteredObservation {
  /** The observation with only the detections that pass every filter. */
  observation: Observation
  /** False when the observation itself is outside the source, date or region filters. */
  matches: boolean
  shownCount: number
  totalCount: number
}

/**
 * Applies every filter to one observation. Grid, hotspots and stats computed from the result
 * reflect only what is shown.
 */
export function applyFilters(observation: Observation, filters: MapFilters): FilteredObservation {
  const matches = observationMatchesFilters(observation, filters)
  const detections = matches ? filterDetections(observation.detections, filters) : []
  return {
    observation:
      detections.length === observation.detections.length
        ? observation
        : { ...observation, detections },
    matches,
    shownCount: detections.length,
    totalCount: observation.detections.length,
  }
}
