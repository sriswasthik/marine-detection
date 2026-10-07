import { describe, expect, it } from 'vitest'
import tokensCss from '@/styles/tokens.css?raw'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { makeDetection, makeScene } from '@/test/geoFixtures'
import { DENSITY_THRESHOLDS, GRID_CELL_SIZE_M, gridCellSizeForResolution } from './config'
import {
  compareDensityLevels,
  computeDensityGrid,
  DENSITY_LEVELS,
  getCell,
  levelForCoverage,
  maxDensityLevel,
  observationDensityLevel,
} from './density'

describe('density levels', () => {
  it('uses the placeholder thresholds at their boundaries', () => {
    expect(levelForCoverage(0)).toBe('low')
    expect(levelForCoverage(DENSITY_THRESHOLDS.moderate - 0.0001)).toBe('low')
    expect(levelForCoverage(DENSITY_THRESHOLDS.moderate)).toBe('moderate')
    expect(levelForCoverage(7.99)).toBe('moderate')
    expect(levelForCoverage(DENSITY_THRESHOLDS.high)).toBe('high')
    expect(levelForCoverage(19.99)).toBe('high')
    expect(levelForCoverage(DENSITY_THRESHOLDS.critical)).toBe('critical')
    expect(levelForCoverage(100)).toBe('critical')
  })

  it('orders levels and finds the highest', () => {
    expect(DENSITY_LEVEL_IDS.map((id) => DENSITY_LEVELS[id].order)).toEqual([0, 1, 2, 3])
    expect(compareDensityLevels('critical', 'low')).toBeGreaterThan(0)
    expect(maxDensityLevel(['low', null, 'high', 'moderate'])).toBe('high')
    expect(maxDensityLevel([])).toBeNull()
  })

  it('has labels and meanings for every level', () => {
    expect(DENSITY_LEVELS.low.meaning).toBe('Small debris coverage')
    expect(DENSITY_LEVELS.critical.label).toBe('Critical')
  })

  it('keeps severity colours identical to the design tokens', () => {
    const css = tokensCss.toLowerCase()
    for (const id of DENSITY_LEVEL_IDS) {
      const meta = DENSITY_LEVELS[id]
      expect(css).toContain(`--color-${id}: ${meta.color.toLowerCase()};`)
      expect(css).toContain(`--color-${id}-stroke: ${meta.stroke.toLowerCase()};`)
      expect(css).toContain(`--color-${id}-soft: ${meta.soft.toLowerCase()};`)
    }
  })

  it('scales the grid cell with resolution', () => {
    expect(gridCellSizeForResolution(10)).toBe(GRID_CELL_SIZE_M)
    expect(gridCellSizeForResolution(0.1)).toBeCloseTo(2.5, 10)
    expect(gridCellSizeForResolution(undefined)).toBe(GRID_CELL_SIZE_M)
  })
})

describe('computeDensityGrid on a known synthetic scene', () => {
  // 1000 m x 500 m at 250 m cells: 4 columns, 2 rows.
  const scene = makeScene(1000, 500)
  const a = makeDetection('a', scene.polygon(scene.rect(50, 50, 150, 150))) // 10,000 m² in r0c0
  const b = makeDetection('b', scene.polygon(scene.rect(400, 100, 600, 160))) // 6,000 m² in r0c1 and r0c2
  const c = makeDetection('c', scene.polygon(scene.rect(760, 260, 990, 490))) // 52,900 m² in r1c3
  const d = makeDetection('d', scene.polygon(scene.rect(10, 300, 30, 320))) // 400 m² in r1c0
  const grid = computeDensityGrid([a, b, c, d], scene.bounds, 250)
  const cell = (row: number, col: number) => {
    const found = getCell(grid, row, col)
    if (!found) throw new Error(`Missing cell r${row}c${col}`)
    return found
  }

  it('builds the expected grid shape', () => {
    expect(grid.cols).toBe(4)
    expect(grid.rows).toBe(2)
    expect(grid.cells).toHaveLength(8)
    expect(cell(1, 3).id).toBe('r1c3')
    expect(cell(0, 0).areaM2).toBeCloseTo(62_500, 6)
  })

  it('measures debris area and coverage per cell', () => {
    expect(cell(0, 0).debrisAreaM2).toBeCloseTo(10_000, 3)
    expect(cell(0, 0).coveragePercent).toBeCloseTo(16, 4)
    expect(cell(0, 1).debrisAreaM2).toBeCloseTo(6_000, 3)
    expect(cell(0, 2).debrisAreaM2).toBeCloseTo(6_000, 3)
    expect(cell(1, 3).coveragePercent).toBeCloseTo(84.64, 3)
    expect(cell(1, 0).coveragePercent).toBeCloseTo(0.64, 4)
    expect(cell(0, 3).debrisAreaM2).toBe(0)
  })

  it('assigns levels, with no level for empty cells', () => {
    expect(cell(0, 0).level).toBe('high')
    expect(cell(0, 1).level).toBe('high')
    expect(cell(1, 3).level).toBe('critical')
    expect(cell(1, 0).level).toBe('low')
    expect(cell(0, 3).level).toBeNull()
    expect(cell(1, 1).level).toBeNull()
  })

  it('lists contributing detections per cell', () => {
    expect(cell(0, 1).detectionIds).toEqual(['b'])
    expect(cell(0, 2).detectionIds).toEqual(['b'])
    expect(cell(0, 0).detectionIds).toEqual(['a'])
    expect(cell(1, 1).detectionIds).toEqual([])
  })

  it('gives each detection the level of its dominant cell', () => {
    expect(grid.detectionLevels).toEqual({ a: 'high', b: 'high', c: 'critical', d: 'low' })
  })

  it('takes the observation level from the highest non-empty cell', () => {
    expect(observationDensityLevel(grid)).toBe('critical')
  })

  it('keeps the grid total consistent with geodesic detection areas', () => {
    const gridTotal = grid.cells.reduce((sum, c) => sum + c.debrisAreaM2, 0)
    const geodesicTotal = [a, b, c, d].reduce((sum, det) => sum + det.areaM2, 0)
    expect(Math.abs(gridTotal - geodesicTotal) / geodesicTotal).toBeLessThan(1e-4)
  })

  it('handles partial edge cells when the scene is not a multiple of the cell size', () => {
    const odd = makeScene(1100, 500)
    const edge = makeDetection('e', odd.polygon(odd.rect(1010, 10, 1090, 60)))
    const oddGrid = computeDensityGrid([edge], odd.bounds, 250)
    expect(oddGrid.cols).toBe(5)
    const last = getCell(oddGrid, 0, 4)
    expect(last?.areaM2).toBeCloseTo(100 * 250, 3)
    expect(last?.coveragePercent).toBeCloseTo((4000 / 25_000) * 100, 3)
    expect(last?.bounds.east).toBeCloseTo(odd.bounds.east, 10)
  })

  it('subtracts holes and ignores debris outside the bounds', () => {
    const ring = scene.rect(300, 300, 500, 480)
    const hole = scene.rect(350, 350, 400, 400)
    const holed = makeDetection('h', scene.polygon(ring, hole))
    const outside = makeDetection('o', scene.polygon(scene.rect(2000, 2000, 2100, 2100)))
    const holedGrid = computeDensityGrid([holed, outside], scene.bounds, 250)
    const total = holedGrid.cells.reduce((sum, c) => sum + c.debrisAreaM2, 0)
    expect(total).toBeCloseTo(200 * 180 - 50 * 50, 2)
    expect(holedGrid.detectionLevels.o).toBeUndefined()
  })

  it('returns an all-empty grid for zero detections', () => {
    const empty = computeDensityGrid([], scene.bounds, 250)
    expect(empty.cells.every((c) => c.level === null && c.coveragePercent === 0)).toBe(true)
    expect(observationDensityLevel(empty)).toBeNull()
  })

  it('rejects a non-positive cell size', () => {
    expect(() => computeDensityGrid([], scene.bounds, 0)).toThrow(RangeError)
  })
})
