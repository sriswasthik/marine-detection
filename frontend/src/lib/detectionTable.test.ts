import { describe, expect, it } from 'vitest'
import type { DensityLevel, Detection } from '@/features/observations/types'
import {
  ariaSort,
  DEFAULT_DETECTION_SORT,
  DETECTION_PAGE_SIZE,
  nextSort,
  sortDetections,
  visibleRowCount,
} from './detectionTable'

const detection = (
  id: string,
  densityLevel: DensityLevel,
  areaM2: number,
  confidence: number,
  lat: number,
): Detection => ({
  id,
  densityLevel,
  areaM2,
  confidence,
  centroid: { lat, lng: 80 },
  sourcePixelCount: 1,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [80, lat],
        [80.001, lat],
        [80.001, lat + 0.001],
        [80, lat],
      ],
    ],
  },
})

const rows = [
  detection('d10', 'low', 300, 0.9, 13.1),
  detection('d2', 'critical', 120, 0.55, 13.3),
  detection('d1', 'high', 300, 0.72, 13.2),
  detection('d3', 'moderate', 50, 0.9, 13.0),
]
const ids = (list: Detection[]) => list.map((d) => d.id)

describe('sortDetections', () => {
  it('sorts by area, largest first, by default, breaking ties by id', () => {
    expect(ids(sortDetections(rows, DEFAULT_DETECTION_SORT))).toEqual(['d1', 'd10', 'd2', 'd3'])
  })

  it('sorts ids in natural order', () => {
    expect(ids(sortDetections(rows, { key: 'id', direction: 'asc' }))).toEqual([
      'd1',
      'd2',
      'd3',
      'd10',
    ])
  })

  it('sorts density by severity, not alphabetically', () => {
    expect(ids(sortDetections(rows, { key: 'density', direction: 'desc' }))).toEqual([
      'd2',
      'd1',
      'd3',
      'd10',
    ])
  })

  it('sorts confidence in both directions with stable ties', () => {
    expect(ids(sortDetections(rows, { key: 'confidence', direction: 'asc' }))).toEqual([
      'd2',
      'd1',
      'd3',
      'd10',
    ])
    expect(ids(sortDetections(rows, { key: 'confidence', direction: 'desc' }))).toEqual([
      'd3',
      'd10',
      'd1',
      'd2',
    ])
  })

  it('sorts centroids by latitude', () => {
    expect(ids(sortDetections(rows, { key: 'centroid', direction: 'desc' }))).toEqual([
      'd2',
      'd1',
      'd10',
      'd3',
    ])
  })

  it('does not modify the input', () => {
    const before = ids(rows)
    sortDetections(rows, { key: 'id', direction: 'desc' })
    expect(ids(rows)).toEqual(before)
  })
})

describe('nextSort and ariaSort', () => {
  it('flips the same column and starts a new one in its useful direction', () => {
    expect(nextSort({ key: 'area', direction: 'desc' }, 'area')).toEqual({
      key: 'area',
      direction: 'asc',
    })
    expect(nextSort({ key: 'area', direction: 'desc' }, 'id')).toEqual({
      key: 'id',
      direction: 'asc',
    })
    expect(nextSort({ key: 'id', direction: 'asc' }, 'confidence')).toEqual({
      key: 'confidence',
      direction: 'desc',
    })
  })

  it('reports aria-sort for the active column only', () => {
    expect(ariaSort({ key: 'area', direction: 'desc' }, 'area')).toBe('descending')
    expect(ariaSort({ key: 'area', direction: 'asc' }, 'area')).toBe('ascending')
    expect(ariaSort({ key: 'area', direction: 'asc' }, 'id')).toBe('none')
  })
})

describe('visibleRowCount', () => {
  const page = DETECTION_PAGE_SIZE

  it('starts with one page, or everything when there is less', () => {
    expect(visibleRowCount({ current: 0, total: 520 })).toBe(page)
    expect(visibleRowCount({ current: 0, total: page - 3 })).toBe(page - 3)
    expect(visibleRowCount({ current: 0, total: 0 })).toBe(0)
  })

  it('extends by whole pages to reach a row that must be shown', () => {
    expect(visibleRowCount({ current: page, total: 520, mustShowIndex: page - 1 })).toBe(page)
    expect(visibleRowCount({ current: page, total: 520, mustShowIndex: page })).toBe(page * 2)
    expect(visibleRowCount({ current: page, total: 520, mustShowIndex: 517 })).toBe(520)
  })

  it('never shrinks what the user already expanded', () => {
    expect(visibleRowCount({ current: page * 3, total: 520, mustShowIndex: 3 })).toBe(page * 3)
  })

  it('takes an explicit page size', () => {
    expect(visibleRowCount({ current: 0, total: 520, mustShowIndex: 120, pageSize: 50 })).toBe(150)
  })
})
