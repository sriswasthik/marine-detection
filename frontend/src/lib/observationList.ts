/**
 * The observations table: search, filters and sorting, kept in the URL so a reload or a shared
 * link shows the same list. Parsing never throws; anything unreadable falls back to the default.
 *
 *   q=ennore                    search in the region name
 *   src=satellite|drone         source
 *   st=completed,partial        statuses (omitted: all)
 *   lv=high,critical,none       density levels, "none" for no debris (omitted: all)
 *   sort=captured&dir=desc      sort column and direction (omitted: newest first)
 */
import {
  DENSITY_LEVEL_IDS,
  OBSERVATION_STATUSES,
  type DensityLevel,
  type ObservationSource,
  type ObservationStatus,
  type ObservationSummary,
} from '@/features/observations/types'
import { DENSITY_LEVELS } from './density'

export const LIST_SORT_KEYS = [
  'region',
  'source',
  'captured',
  'status',
  'density',
  'coverage',
  'detections',
  'confidence',
] as const
export type ListSortKey = (typeof LIST_SORT_KEYS)[number]
export type ListDirection = 'asc' | 'desc'

/** A density filter value: a level, or "none" for observations without debris. */
export type DensityFilter = DensityLevel | 'none'
export const DENSITY_FILTERS: readonly DensityFilter[] = [...DENSITY_LEVEL_IDS, 'none']

export interface ListQuery {
  search: string
  source: 'all' | ObservationSource
  /** Empty means every status. */
  statuses: readonly ObservationStatus[]
  /** Empty means every level. */
  levels: readonly DensityFilter[]
  sort: ListSortKey
  direction: ListDirection
}

export const DEFAULT_LIST_QUERY: ListQuery = {
  search: '',
  source: 'all',
  statuses: [],
  levels: [],
  sort: 'captured',
  direction: 'desc',
}

const MAX_SEARCH = 100

function picks<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return []
  const chosen = new Set(value.split(',').map((item) => item.trim()))
  // Canonical order, no duplicates, unknown values dropped.
  return allowed.filter((item) => chosen.has(item))
}

export function parseListSearch(input: URLSearchParams | string): ListQuery {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input
  const source = params.get('src')
  const sort = params.get('sort')
  const direction = params.get('dir')
  const statuses = picks(params.get('st'), OBSERVATION_STATUSES)
  const levels = picks(params.get('lv'), DENSITY_FILTERS)
  return {
    search: (params.get('q') ?? '').trim().slice(0, MAX_SEARCH),
    source: source === 'satellite' || source === 'drone' ? source : 'all',
    // Every option selected is the same as no filter.
    statuses: statuses.length === OBSERVATION_STATUSES.length ? [] : statuses,
    levels: levels.length === DENSITY_FILTERS.length ? [] : levels,
    sort: (LIST_SORT_KEYS as readonly string[]).includes(sort ?? '')
      ? (sort as ListSortKey)
      : DEFAULT_LIST_QUERY.sort,
    direction:
      direction === 'asc' || direction === 'desc' ? direction : DEFAULT_LIST_QUERY.direction,
  }
}

/** Canonical query string: defaults are left out. */
export function serializeListSearch(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.search.trim()) params.set('q', query.search.trim())
  if (query.source !== 'all') params.set('src', query.source)
  if (query.statuses.length > 0) params.set('st', query.statuses.join(','))
  if (query.levels.length > 0) params.set('lv', query.levels.join(','))
  if (query.sort !== DEFAULT_LIST_QUERY.sort || query.direction !== DEFAULT_LIST_QUERY.direction) {
    params.set('sort', query.sort)
    params.set('dir', query.direction)
  }
  return params
}

/** True when anything narrows the list (sorting does not). */
export function isFiltered(query: ListQuery): boolean {
  return (
    query.search.trim() !== '' ||
    query.source !== 'all' ||
    query.statuses.length > 0 ||
    query.levels.length > 0
  )
}

/** Accent- and case-insensitive text for searching. */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function filterList<T extends ObservationSummary>(
  list: readonly T[],
  query: ListQuery,
): T[] {
  const words = fold(query.search).split(/\s+/).filter(Boolean)
  return list.filter((o) => {
    if (query.source !== 'all' && o.source !== query.source) return false
    if (query.statuses.length > 0 && !query.statuses.includes(o.status)) return false
    if (query.levels.length > 0) {
      const level: DensityFilter = o.detectionCount > 0 && o.densityLevel ? o.densityLevel : 'none'
      if (!query.levels.includes(level)) return false
    }
    if (words.length > 0) {
      const region = fold(o.region)
      if (!words.every((word) => region.includes(word))) return false
    }
    return true
  })
}

const STATUS_ORDER: Readonly<Record<ObservationStatus, number>> = {
  failed: 0,
  queued: 1,
  processing: 2,
  partial: 3,
  completed: 4,
}

const REGION_COLLATOR = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/** A sortable value. Missing values (no confidence, no density) always sort last. */
function sortValue(o: ObservationSummary, key: ListSortKey): number | string | null {
  switch (key) {
    case 'region':
      return o.region
    case 'source':
      return o.source
    case 'captured':
      return Date.parse(o.capturedAt)
    case 'status':
      return STATUS_ORDER[o.status]
    case 'density':
      return o.detectionCount > 0 && o.densityLevel ? DENSITY_LEVELS[o.densityLevel].order : null
    case 'coverage':
      return o.coveragePercent
    case 'detections':
      return o.detectionCount
    case 'confidence':
      return o.averageConfidence
  }
}

/** Sorted copy. Ties fall back to newest first, then the id, so the order is stable. */
export function sortList<T extends ObservationSummary>(
  list: readonly T[],
  sort: ListSortKey,
  direction: ListDirection,
): T[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const va = sortValue(a, sort)
    const vb = sortValue(b, sort)
    if (va === null || vb === null || (typeof va === 'number' && Number.isNaN(va))) {
      if (va !== vb) return va === null ? 1 : vb === null ? -1 : 0
    }
    let primary = 0
    if (typeof va === 'string' && typeof vb === 'string') primary = REGION_COLLATOR.compare(va, vb)
    else if (typeof va === 'number' && typeof vb === 'number') primary = va - vb
    return sign * primary || b.capturedAt.localeCompare(a.capturedAt) || a.id.localeCompare(b.id)
  })
}

/** A new column starts in its most useful direction (text A to Z, figures high to low); the same column flips. */
export function nextListSort(
  query: ListQuery,
  key: ListSortKey,
): Pick<ListQuery, 'sort' | 'direction'> {
  if (query.sort === key)
    return { sort: key, direction: query.direction === 'asc' ? 'desc' : 'asc' }
  return { sort: key, direction: key === 'region' || key === 'source' ? 'asc' : 'desc' }
}
