import { SOURCE_LABELS } from '@/features/observations/labels'
import { DENSITY_LEVELS } from '@/lib/density'
import { DEFAULT_FILTERS, hasActiveFilters, type MapFilters } from '@/lib/filters'
import { formatConfidence } from '@/lib/format'

/**
 * The active map filters in plain words, for exports made from the map: "Confidence 70% or more;
 * density High, Critical". Null when nothing is filtered.
 */
export function describeFilters(filters: MapFilters): string | null {
  if (!hasActiveFilters(filters)) return null
  const parts: string[] = []
  if (filters.source !== 'all') {
    parts.push(`source ${SOURCE_LABELS[filters.source].toLowerCase()}`)
  }
  if (filters.dateFrom || filters.dateTo) {
    parts.push(
      filters.dateFrom && filters.dateTo
        ? `captured ${filters.dateFrom} to ${filters.dateTo}`
        : filters.dateFrom
          ? `captured from ${filters.dateFrom}`
          : `captured until ${filters.dateTo ?? ''}`,
    )
  }
  if (filters.minConfidence > 0) {
    parts.push(`confidence ${formatConfidence(filters.minConfidence)} or more`)
  }
  if (filters.levels.length < DEFAULT_FILTERS.levels.length) {
    parts.push(
      filters.levels.length === 0
        ? 'no density levels'
        : `density ${filters.levels.map((level) => DENSITY_LEVELS[level].label).join(', ')}`,
    )
  }
  if (filters.region) parts.push(`region ${filters.region}`)
  const text = parts.join('; ')
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}
