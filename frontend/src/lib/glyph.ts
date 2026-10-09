import type { DensityLevel, Observation } from '@/features/observations/types'
import { observationDensityGrid } from './analysis'
import { maxDensityLevel, type DensityGrid } from './density'

/** At most this many cells per side: enough to recognise a scene at 16px. */
export const GLYPH_MAX_CELLS = 6

export interface GlyphGrid {
  rows: number
  cols: number
  /** Row-major from the north-west corner. Null for cells without debris. */
  cells: (DensityLevel | null)[]
}

/**
 * Downsamples a density grid to at most `max` cells per side. A glyph cell takes the most severe
 * level of the map cells it covers, so the glyph and the map's density layer agree.
 */
export function glyphFromDensityGrid(grid: DensityGrid, max = GLYPH_MAX_CELLS): GlyphGrid {
  const rows = Math.min(max, grid.rows)
  const cols = Math.min(max, grid.cols)
  const buckets: (DensityLevel | null)[][] = Array.from({ length: rows * cols }, () => [])
  for (const cell of grid.cells) {
    if (!cell.level) continue
    // Map rows count from the south; glyph rows from the north.
    const row = rows - 1 - Math.floor((cell.row * rows) / grid.rows)
    const col = Math.floor((cell.col * cols) / grid.cols)
    buckets[row * cols + col]?.push(cell.level)
  }
  return { rows, cols, cells: buckets.map((levels) => maxDensityLevel(levels)) }
}

/**
 * The glyph of an observation, from the same grid as the map (the service's for real model
 * output), or null when it has no bounds to grid.
 */
export function observationGlyph(
  observation: Pick<
    Observation,
    'detections' | 'bounds' | 'resolutionM' | 'densityGrid' | 'hotspots'
  >,
  max = GLYPH_MAX_CELLS,
): GlyphGrid | null {
  if (!observation.bounds) return null
  const grid = observationDensityGrid(observation)
  return grid ? glyphFromDensityGrid(grid, max) : null
}

/** True when no cell holds debris: the glyph shows an empty grid with a centred tick. */
export function isEmptyGlyph(glyph: GlyphGrid): boolean {
  return glyph.cells.every((cell) => cell === null)
}
