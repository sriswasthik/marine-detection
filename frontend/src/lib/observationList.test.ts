import { describe, expect, it } from 'vitest'
import type { ObservationSummary } from '@/features/observations/types'
import {
  DEFAULT_LIST_QUERY,
  filterList,
  isFiltered,
  nextListSort,
  parseListSearch,
  serializeListSearch,
  sortList,
  type ListQuery,
} from './observationList'

function obs(patch: Partial<ObservationSummary> & { id: string }): ObservationSummary {
  return {
    name: patch.id,
    source: 'satellite',
    capturedAt: '2026-09-01T00:00:00Z',
    region: patch.id,
    imageUrl: '',
    previewUrl: '',
    bounds: null,
    crs: 'EPSG:4326',
    status: 'completed',
    debrisAreaM2: 0,
    waterAreaM2: 1,
    coveragePercent: 0,
    averageConfidence: null,
    densityLevel: null,
    detectionCount: 0,
    ...patch,
  }
}

const list = [
  obs({
    id: 'a',
    region: 'Ennore coast, Bay of Bengal',
    capturedAt: '2026-10-03T05:00:00Z',
    densityLevel: 'critical',
    detectionCount: 61,
    coveragePercent: 0.42,
    averageConfidence: 0.7,
  }),
  obs({
    id: 'b',
    region: 'Mahim Bay, Mumbai',
    source: 'drone',
    capturedAt: '2026-09-29T04:00:00Z',
    densityLevel: 'moderate',
    detectionCount: 25,
    coveragePercent: 0.03,
    averageConfidence: 0.75,
  }),
  obs({ id: 'c', region: 'Gulf of Mannar', capturedAt: '2026-09-18T05:00:00Z' }),
  obs({
    id: 'd',
    region: 'Sundarbans delta',
    capturedAt: '2026-08-31T04:00:00Z',
    status: 'partial',
    densityLevel: 'moderate',
    detectionCount: 20,
    coveragePercent: 0.11,
    averageConfidence: 0.72,
  }),
  obs({
    id: 'e',
    region: 'Baía de Todos os Santos',
    capturedAt: '2026-08-01T00:00:00Z',
    status: 'failed',
  }),
]
const ids = (items: ObservationSummary[]) => items.map((o) => o.id)
const query = (patch: Partial<ListQuery>): ListQuery => ({ ...DEFAULT_LIST_QUERY, ...patch })

describe('filterList', () => {
  it('searches the region, ignoring case and accents, word by word', () => {
    expect(ids(filterList(list, query({ search: 'BAY' })))).toEqual(['a', 'b'])
    expect(ids(filterList(list, query({ search: 'bengal ennore' })))).toEqual(['a'])
    expect(ids(filterList(list, query({ search: 'baia todos' })))).toEqual(['e'])
  })

  it('filters by source, status and density level, with "none" for no debris', () => {
    expect(ids(filterList(list, query({ source: 'drone' })))).toEqual(['b'])
    expect(ids(filterList(list, query({ statuses: ['partial', 'failed'] })))).toEqual(['d', 'e'])
    expect(ids(filterList(list, query({ levels: ['moderate'] })))).toEqual(['b', 'd'])
    expect(ids(filterList(list, query({ levels: ['none'] })))).toEqual(['c', 'e'])
  })

  it('combines filters, and returns nothing when nothing matches', () => {
    expect(ids(filterList(list, query({ source: 'drone', levels: ['critical'] })))).toEqual([])
  })
})

describe('sortList', () => {
  it('sorts newest first by default', () => {
    expect(ids(sortList(list, 'captured', 'desc'))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('sorts every column, with missing values last in both directions', () => {
    expect(ids(sortList(list, 'region', 'asc'))).toEqual(['e', 'a', 'c', 'b', 'd'])
    expect(ids(sortList(list, 'detections', 'desc'))).toEqual(['a', 'b', 'd', 'c', 'e'])
    expect(ids(sortList(list, 'coverage', 'asc'))).toEqual(['c', 'e', 'b', 'd', 'a'])
    expect(ids(sortList(list, 'density', 'desc'))).toEqual(['a', 'b', 'd', 'c', 'e'])
    expect(ids(sortList(list, 'density', 'asc'))).toEqual(['b', 'd', 'a', 'c', 'e'])
    expect(ids(sortList(list, 'confidence', 'asc'))).toEqual(['a', 'd', 'b', 'c', 'e'])
    expect(ids(sortList(list, 'confidence', 'desc'))).toEqual(['b', 'd', 'a', 'c', 'e'])
    expect(ids(sortList(list, 'status', 'asc'))).toEqual(['e', 'd', 'a', 'b', 'c'])
    expect(ids(sortList(list, 'source', 'asc'))).toEqual(['b', 'a', 'c', 'd', 'e'])
  })

  it('flips the same column and starts a new one in its useful direction', () => {
    expect(nextListSort(query({ sort: 'coverage', direction: 'desc' }), 'coverage')).toEqual({
      sort: 'coverage',
      direction: 'asc',
    })
    expect(nextListSort(DEFAULT_LIST_QUERY, 'region')).toEqual({ sort: 'region', direction: 'asc' })
    expect(nextListSort(DEFAULT_LIST_QUERY, 'detections')).toEqual({
      sort: 'detections',
      direction: 'desc',
    })
  })
})

describe('URL state', () => {
  it('round-trips a query and leaves defaults out', () => {
    const q = query({
      search: 'bay',
      source: 'satellite',
      statuses: ['completed'],
      levels: ['high', 'none'],
      sort: 'coverage',
      direction: 'asc',
    })
    const text = serializeListSearch(q).toString()
    expect(text).toBe('q=bay&src=satellite&st=completed&lv=high%2Cnone&sort=coverage&dir=asc')
    expect(parseListSearch(text)).toEqual(q)
    expect(serializeListSearch(DEFAULT_LIST_QUERY).toString()).toBe('')
  })

  it('ignores unknown values', () => {
    expect(parseListSearch('src=boat&st=nope,failed&lv=huge&sort=colour&dir=up')).toEqual(
      query({ statuses: ['failed'] }),
    )
  })

  it('treats every option selected as no filter', () => {
    expect(parseListSearch('st=queued,processing,completed,partial,failed').statuses).toEqual([])
  })

  it('knows when the list is narrowed', () => {
    expect(isFiltered(DEFAULT_LIST_QUERY)).toBe(false)
    expect(isFiltered(query({ sort: 'region' }))).toBe(false)
    expect(isFiltered(query({ search: ' x ' }))).toBe(true)
  })
})
