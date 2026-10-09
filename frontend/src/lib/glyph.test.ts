import { describe, expect, it } from 'vitest'
import { getSampleObservations } from '@/features/observations/mock/samples'
import { computeDensityGrid, type DensityCell, type DensityGrid } from './density'
import { glyphFromDensityGrid, isEmptyGlyph, observationGlyph } from './glyph'

function grid(
  rows: number,
  cols: number,
  levels: Record<string, DensityCell['level']>,
): DensityGrid {
  const cells: DensityCell[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        id: `r${row}c${col}`,
        row,
        col,
        bounds: { north: 0, south: 0, east: 0, west: 0 },
        areaM2: 1,
        debrisAreaM2: 0,
        coveragePercent: 0,
        level: levels[`r${row}c${col}`] ?? null,
        detectionIds: [],
      })
    }
  }
  return {
    bounds: { north: 1, south: 0, east: 1, west: 0 },
    cellSizeM: 1,
    rows,
    cols,
    cells,
    detectionLevels: {},
    source: 'browser',
  }
}

describe('glyphFromDensityGrid', () => {
  it('keeps small grids as they are, with the north row first', () => {
    const glyph = glyphFromDensityGrid(grid(2, 2, { r0c0: 'low', r1c1: 'critical' }))
    expect(glyph).toEqual({ rows: 2, cols: 2, cells: [null, 'critical', 'low', null] })
  })

  it('downsamples large grids to six cells a side, keeping the most severe level', () => {
    const glyph = glyphFromDensityGrid(
      grid(12, 12, { r0c0: 'low', r0c1: 'high', r11c11: 'moderate' }),
    )
    expect(glyph.rows).toBe(6)
    expect(glyph.cols).toBe(6)
    // South-west map cells land in the glyph's bottom-left cell.
    expect(glyph.cells[5 * 6]).toBe('high')
    expect(glyph.cells[5]).toBe('moderate')
    expect(glyph.cells.filter(Boolean)).toHaveLength(2)
  })

  it('is empty when no cell holds debris', () => {
    expect(isEmptyGlyph(glyphFromDensityGrid(grid(4, 4, {})))).toBe(true)
  })
})

describe('observationGlyph', () => {
  const samples = getSampleObservations()

  it('is deterministic and agrees with the density grid of every sample scene', () => {
    for (const observation of samples) {
      const a = observationGlyph(observation)
      const b = observationGlyph(observation)
      expect(a).toEqual(b)
      if (!a || !observation.bounds) continue
      const hasDebris = computeDensityGrid(observation.detections, observation.bounds).cells.some(
        (c) => c.level,
      )
      expect(isEmptyGlyph(a)).toBe(!hasDebris)
    }
  })

  it('tells scenes apart', () => {
    const glyphs = new Set(samples.map((o) => JSON.stringify(observationGlyph(o))))
    expect(glyphs.size).toBeGreaterThan(1)
  })

  it('is null without bounds', () => {
    const first = samples[0]
    if (!first) throw new Error('No samples')
    expect(observationGlyph({ ...first, bounds: null })).toBeNull()
  })
})
