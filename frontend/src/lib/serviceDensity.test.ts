import { describe, expect, it } from 'vitest'
import type {
  Detection,
  GeoBounds,
  Hotspot,
  ServiceDensityGrid,
} from '@/features/observations/types'
import { analyzeObservation } from './analysis'
import { coversServiceDetections, densityGridFromService } from './serviceDensity'

const BOUNDS: GeoBounds = { south: 0, north: 0.03, west: 0, east: 0.03 }

const cellBounds = (row: number, col: number): GeoBounds => ({
  south: row * 0.01,
  north: (row + 1) * 0.01,
  west: col * 0.01,
  east: (col + 1) * 0.01,
})

/** 3 x 3 cells of 250 m. a sits in r1c1; b spreads over r1c1 (1000 m²) and r1c2 (1500 m²). */
const SERVICE: ServiceDensityGrid = {
  method: 'Blocks of 25 x 25 source pixels.',
  cellSizeM: 250,
  cellSizePx: 25,
  rows: 3,
  cols: 3,
  thresholds: { moderate: 2, high: 8, critical: 20 },
  cells: [
    {
      id: 'r1c1',
      row: 1,
      col: 1,
      bounds: cellBounds(1, 1),
      areaM2: 62500,
      debrisAreaM2: 7000,
      coveragePercent: 11.2,
      level: 'high',
      detectionAreasM2: { a: 6000, b: 1000 },
    },
    {
      id: 'r1c2',
      row: 1,
      col: 2,
      bounds: cellBounds(1, 2),
      areaM2: 62500,
      debrisAreaM2: 1500,
      coveragePercent: 2.4,
      level: 'moderate',
      detectionAreasM2: { b: 1500 },
    },
  ],
}

const SERVICE_HOTSPOTS: Hotspot[] = [
  {
    id: 'hotspot-1',
    rank: 1,
    level: 'high',
    bounds: cellBounds(1, 1),
    centroid: { lat: 0.015, lng: 0.015 },
    cellIds: ['r1c1'],
    detectionIds: ['a', 'b'],
    totalAreaM2: 7000,
    meanConfidence: 0.6,
    priorityScore: 12600,
  },
]

function detection(id: string, confidence: number, areaM2: number): Detection {
  return {
    id,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0.015, 0.015],
          [0.016, 0.015],
          [0.016, 0.016],
          [0.015, 0.015],
        ],
      ],
    },
    areaM2,
    confidence,
    densityLevel: 'high',
    centroid: { lat: 0.015, lng: 0.015 },
    sourcePixelCount: areaM2 / 100,
  }
}

const A = detection('a', 0.8, 6000)
const B = detection('b', 0.4, 2500)

function observation(detections: Detection[], grid: ServiceDensityGrid = SERVICE) {
  return {
    detections,
    bounds: BOUNDS,
    resolutionM: 10,
    densityGrid: grid,
    hotspots: SERVICE_HOTSPOTS,
  }
}

describe('coversServiceDetections', () => {
  it('is true only for exactly the graded detections', () => {
    expect(coversServiceDetections(SERVICE, [A, B])).toBe(true)
    expect(coversServiceDetections(SERVICE, [B])).toBe(false)
    expect(coversServiceDetections(SERVICE, [A, B, detection('c', 0.5, 100)])).toBe(false)
    expect(coversServiceDetections({ ...SERVICE, cells: [] }, [])).toBe(true)
  })
})

describe('densityGridFromService', () => {
  it('keeps the service values as sent for the full detection set', () => {
    const grid = densityGridFromService(SERVICE, [A, B], BOUNDS)
    expect(grid.source).toBe('service')
    expect(grid.cells).toHaveLength(9)
    const r1c1 = grid.cells[1 * 3 + 1]
    expect(r1c1).toMatchObject({
      id: 'r1c1',
      coveragePercent: 11.2,
      level: 'high',
      debrisAreaM2: 7000,
    })
    expect(r1c1?.detectionIds).toEqual(['a', 'b'])
    // b has more area in r1c2 (1500) than in r1c1 (1000).
    expect(grid.detectionLevels).toEqual({ a: 'high', b: 'moderate' })
  })

  it('fills unlisted cells as empty, inside the bounds', () => {
    const grid = densityGridFromService(SERVICE, [A, B], BOUNDS)
    const empty = grid.cells[0]
    expect(empty).toMatchObject({ id: 'r0c0', level: null, debrisAreaM2: 0, detectionIds: [] })
    expect(empty?.bounds.south).toBeCloseTo(0)
    expect(empty?.bounds.north).toBeCloseTo(0.01)
  })

  it('regrades a subset from the measured areas', () => {
    const grid = densityGridFromService(SERVICE, [B], BOUNDS)
    const r1c1 = grid.cells[4]
    expect(r1c1?.debrisAreaM2).toBe(1000)
    expect(r1c1?.coveragePercent).toBeCloseTo(1.6)
    expect(r1c1?.level).toBe('low')
    expect(r1c1?.detectionIds).toEqual(['b'])
    expect(grid.cells[5]?.level).toBe('moderate')
    expect(grid.detectionLevels).toEqual({ b: 'moderate' })
    expect(densityGridFromService(SERVICE, [], BOUNDS).cells.every((c) => c.level === null)).toBe(
      true,
    )
  })

  it("grades with the service's thresholds", () => {
    const lower = { ...SERVICE, thresholds: { moderate: 1, high: 8, critical: 20 } }
    expect(densityGridFromService(lower, [B], BOUNDS).cells[4]?.level).toBe('moderate')
  })
})

describe('analyzeObservation with a service grid', () => {
  it('uses the service hotspots as sent for the full detection set', () => {
    const analysis = analyzeObservation(observation([A, B]))
    expect(analysis.grid?.source).toBe('service')
    expect(analysis.hotspots).toBe(SERVICE_HOTSPOTS)
    expect(analysis.stats.hotspotCount).toBe(1)
  })

  it('regroups hotspots from the service cells when the map shows a subset', () => {
    const analysis = analyzeObservation(observation([B]))
    // Without a, no cell is High, so the Moderate cell forms the only hotspot.
    expect(analysis.hotspots).toHaveLength(1)
    expect(analysis.hotspots[0]).toMatchObject({
      rank: 1,
      level: 'moderate',
      cellIds: ['r1c2'],
      detectionIds: ['b'],
      totalAreaM2: 1500,
      meanConfidence: 0.4,
    })
  })

  it('falls back to the browser grid without a service grid', () => {
    const { densityGrid: _grid, hotspots: _hotspots, ...synthetic } = observation([A, B])
    expect(analyzeObservation(synthetic).grid?.source).toBe('browser')
  })
})
