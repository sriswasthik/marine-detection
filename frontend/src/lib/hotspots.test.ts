import { describe, expect, it } from 'vitest'
import type { DensityLevel, Detection } from '@/features/observations/types'
import type { DensityCell, DensityGrid } from './density'
import { findHotspots, HOTSPOT_LEVEL_WEIGHTS, priorityScore, PRIORITY_SCORE_RULE } from './hotspots'

const CELL_AREA = 62_500
const DEBRIS_BY_LEVEL: Record<DensityLevel, number> = {
  low: 500,
  moderate: 3_000,
  high: 7_500,
  critical: 15_000,
}

/**
 * Builds a grid from a picture of levels. Rows are listed north to south, as they read,
 * so the last string is row 0. "." is empty, l/m/h/c are Low to Critical.
 */
function gridFromPicture(
  picture: string[],
  confidence = 0.8,
): { grid: DensityGrid; detections: Detection[] } {
  const symbols: Record<string, DensityLevel | null> = {
    '.': null,
    l: 'low',
    m: 'moderate',
    h: 'high',
    c: 'critical',
  }
  const rows = picture.length
  const cols = picture[0]?.length ?? 0
  const cells: DensityCell[] = []
  const detections: Detection[] = []
  const step = 0.0025
  for (let row = 0; row < rows; row++) {
    const line = picture[rows - 1 - row] ?? ''
    for (let col = 0; col < cols; col++) {
      const level = symbols[line[col] ?? '.'] ?? null
      const debrisAreaM2 = level ? DEBRIS_BY_LEVEL[level] : 0
      const id = `r${row}c${col}`
      const detectionIds = level ? [`det-${id}`] : []
      cells.push({
        id,
        row,
        col,
        bounds: {
          south: 10 + row * step,
          north: 10 + (row + 1) * step,
          west: 80 + col * step,
          east: 80 + (col + 1) * step,
        },
        areaM2: CELL_AREA,
        debrisAreaM2,
        coveragePercent: (debrisAreaM2 / CELL_AREA) * 100,
        level,
        detectionIds,
      })
      if (level) {
        detections.push({
          id: `det-${id}`,
          geometry: { type: 'Polygon', coordinates: [] },
          areaM2: debrisAreaM2,
          confidence,
          densityLevel: level,
          centroid: { lat: 10 + (row + 0.5) * step, lng: 80 + (col + 0.5) * step },
          sourcePixelCount: Math.round(debrisAreaM2 / 100),
        })
      }
    }
  }
  const grid: DensityGrid = {
    bounds: { south: 10, north: 10 + rows * step, west: 80, east: 80 + cols * step },
    cellSizeM: 250,
    rows,
    cols,
    cells,
    detectionLevels: {},
  }
  return { grid, detections }
}

describe('findHotspots', () => {
  it('joins diagonal neighbours into one hotspot (8-neighbour)', () => {
    const { grid, detections } = gridFromPicture(['h...', '.h..', '....'])
    const hotspots = findHotspots(grid, detections)
    expect(hotspots).toHaveLength(1)
    expect(hotspots[0]?.cellIds).toEqual(['r1c1', 'r2c0'])
  })

  it('keeps separated groups apart and ranks by priority score', () => {
    const { grid, detections } = gridFromPicture(['hh...', '.....', '...cc', '...c.'])
    const hotspots = findHotspots(grid, detections)
    expect(hotspots).toHaveLength(2)
    const [first, second] = hotspots
    expect(first?.level).toBe('critical')
    expect(first?.rank).toBe(1)
    expect(first?.id).toBe('hotspot-1')
    expect(first?.cellIds).toHaveLength(3)
    expect(second?.level).toBe('high')
    expect(second?.rank).toBe(2)
    expect((first?.priorityScore ?? 0) > (second?.priorityScore ?? 0)).toBe(true)
  })

  it('uses the highest level in a mixed High and Critical group', () => {
    const { grid, detections } = gridFromPicture(['hch'])
    const [hotspot] = findHotspots(grid, detections)
    expect(hotspot?.level).toBe('critical')
    expect(hotspot?.totalAreaM2).toBe(7_500 * 2 + 15_000)
  })

  it('leaves Moderate cells out when High or Critical cells exist', () => {
    const { grid, detections } = gridFromPicture(['mhm', 'mmm'])
    const hotspots = findHotspots(grid, detections)
    expect(hotspots).toHaveLength(1)
    expect(hotspots[0]?.cellIds).toEqual(['r1c1'])
  })

  it('falls back to Moderate groups when nothing is High or Critical', () => {
    const { grid, detections } = gridFromPicture(['mm..l', '....m', 'l....'])
    const hotspots = findHotspots(grid, detections)
    expect(hotspots).toHaveLength(2)
    expect(hotspots.every((h) => h.level === 'moderate')).toBe(true)
    expect(hotspots[0]?.cellIds).toHaveLength(2)
  })

  it('returns no hotspots for Low-only or empty observations', () => {
    const lowOnly = gridFromPicture(['l.l', '.l.'])
    expect(findHotspots(lowOnly.grid, lowOnly.detections)).toEqual([])
    const empty = gridFromPicture(['...', '...'])
    expect(findHotspots(empty.grid, [])).toEqual([])
  })

  it('computes the documented priority score', () => {
    const { grid, detections } = gridFromPicture(['h'], 0.9)
    const [hotspot] = findHotspots(grid, detections)
    expect(hotspot?.meanConfidence).toBeCloseTo(0.9, 10)
    expect(hotspot?.priorityScore).toBeCloseTo(7_500 * 0.9 * HOTSPOT_LEVEL_WEIGHTS.high, 6)
    expect(priorityScore(1000, 0.5, 'critical')).toBe(2000)
    expect(PRIORITY_SCORE_RULE).toMatch(/level weight/)
  })

  it('reports bounds, centroid and detection ids for a group', () => {
    const { grid, detections } = gridFromPicture(['cc'])
    const [hotspot] = findHotspots(grid, detections)
    expect(hotspot?.bounds).toEqual({ south: 10, north: 10.0025, west: 80, east: 80.005 })
    expect(hotspot?.centroid.lng).toBeCloseTo(80.0025, 10)
    expect(hotspot?.detectionIds).toEqual(['det-r0c0', 'det-r0c1'])
  })

  it('uses zero mean confidence when detections are missing', () => {
    const { grid } = gridFromPicture(['h'])
    const [hotspot] = findHotspots(grid, [])
    expect(hotspot?.meanConfidence).toBe(0)
    expect(hotspot?.priorityScore).toBe(0)
  })
})
