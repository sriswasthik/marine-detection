import type { Detection } from '@/features/observations/types'
import { DENSITY_LEVELS } from './density'

export const DETECTION_SORT_KEYS = ['id', 'density', 'area', 'confidence', 'centroid'] as const
export type DetectionSortKey = (typeof DETECTION_SORT_KEYS)[number]
export type SortDirection = 'asc' | 'desc'

export interface DetectionSort {
  key: DetectionSortKey
  direction: SortDirection
}

/** Largest regions first: the ones most worth a look. */
export const DEFAULT_DETECTION_SORT: DetectionSort = { key: 'area', direction: 'desc' }

/** Rows rendered at first, and added by each "Show more". */
export const DETECTION_PAGE_SIZE = 25

/** Natural order for ids such as "d2" and "d10". */
const ID_COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function compareBy(key: DetectionSortKey, a: Detection, b: Detection): number {
  switch (key) {
    case 'id':
      return ID_COLLATOR.compare(a.id, b.id)
    case 'density':
      return DENSITY_LEVELS[a.densityLevel].order - DENSITY_LEVELS[b.densityLevel].order
    case 'area':
      return a.areaM2 - b.areaM2
    case 'confidence':
      return a.confidence - b.confidence
    case 'centroid':
      // North to south reads more naturally as "descending"; ascending is south first.
      return a.centroid.lat - b.centroid.lat || a.centroid.lng - b.centroid.lng
  }
}

/**
 * Sorted copy. Ties fall back to the id in natural order (always ascending), so the order is
 * stable and predictable whatever the direction.
 */
export function sortDetections(detections: readonly Detection[], sort: DetectionSort): Detection[] {
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...detections].sort(
    (a, b) => sign * compareBy(sort.key, a, b) || ID_COLLATOR.compare(a.id, b.id),
  )
}

/**
 * Clicking a column header: a new column starts in its most useful direction (text ascending,
 * figures descending); the same column flips.
 */
export function nextSort(current: DetectionSort, key: DetectionSortKey): DetectionSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key, direction: key === 'id' ? 'asc' : 'desc' }
}

/**
 * How many rows to render: the current count, extended by whole pages when the row that must be
 * visible (the selected detection) is further down. Never more than the total.
 */
export function visibleRowCount(options: {
  current: number
  total: number
  /** Index of a row that must be rendered, or -1 for none. */
  mustShowIndex?: number
  pageSize?: number
}): number {
  const pageSize = options.pageSize ?? DETECTION_PAGE_SIZE
  let count = Math.max(options.current, Math.min(pageSize, options.total))
  const index = options.mustShowIndex ?? -1
  if (index >= count) count = Math.ceil((index + 1) / pageSize) * pageSize
  return Math.min(count, options.total)
}

/** aria-sort value for a column header. */
export function ariaSort(
  sort: DetectionSort,
  key: DetectionSortKey,
): 'ascending' | 'descending' | 'none' {
  if (sort.key !== key) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}
