import type {
  DensityLevel,
  GeoBounds,
  ServiceDensityCell,
  ServiceDensityGrid,
} from '@/features/observations/types'
import { levelForCoverage, type DensityCell, type DensityGrid } from '@/lib/density'

type Identified = { id: string }

/** Every detection id the service's grid counted. */
export function serviceDetectionIds(grid: ServiceDensityGrid): Set<string> {
  return new Set(grid.cells.flatMap((cell) => Object.keys(cell.detectionAreasM2)))
}

/**
 * True when `detections` are exactly the ones the service graded: no map filter applied and no
 * detection dropped as malformed. Only then are the service's levels and hotspots used as sent.
 */
export function coversServiceDetections(
  grid: ServiceDensityGrid,
  detections: readonly Identified[],
): boolean {
  const graded = serviceDetectionIds(grid)
  return graded.size === detections.length && detections.every((d) => graded.has(d.id))
}

const cellIndex = (grid: Pick<ServiceDensityGrid, 'cols'>, row: number, col: number) =>
  row * grid.cols + col

/** A cell the service did not list: no debris. Its bounds split `bounds` evenly; it is never drawn. */
function emptyCell(grid: ServiceDensityGrid, bounds: GeoBounds, row: number, col: number) {
  const latStep = (bounds.north - bounds.south) / grid.rows
  const lngStep = (bounds.east - bounds.west) / grid.cols
  return {
    id: `r${row}c${col}`,
    row,
    col,
    bounds: {
      south: bounds.south + row * latStep,
      north: bounds.south + (row + 1) * latStep,
      west: bounds.west + col * lngStep,
      east: bounds.west + (col + 1) * lngStep,
    },
    areaM2: grid.cellSizeM * grid.cellSizeM,
    debrisAreaM2: 0,
    coveragePercent: 0,
    level: null,
    detectionIds: [],
  } satisfies DensityCell
}

/** A listed cell, keeping only the shown detections' measured areas. */
function measuredCell(
  cell: ServiceDensityCell,
  shown: ReadonlySet<string>,
  complete: boolean,
  grid: ServiceDensityGrid,
): DensityCell {
  const ids = Object.keys(cell.detectionAreasM2)
    .filter((id) => shown.has(id))
    .sort()
  const base = {
    id: cell.id,
    row: cell.row,
    col: cell.col,
    bounds: cell.bounds,
    areaM2: cell.areaM2,
  }
  if (complete) {
    return {
      ...base,
      debrisAreaM2: cell.debrisAreaM2,
      coveragePercent: cell.coveragePercent,
      level: cell.level,
      detectionIds: ids,
    }
  }
  const debrisAreaM2 = ids.reduce((sum, id) => sum + (cell.detectionAreasM2[id] ?? 0), 0)
  const coveragePercent = cell.areaM2 > 0 ? (debrisAreaM2 / cell.areaM2) * 100 : 0
  return {
    ...base,
    debrisAreaM2,
    coveragePercent,
    level: debrisAreaM2 > 0 ? levelForCoverage(coveragePercent, grid.thresholds) : null,
    detectionIds: ids,
  }
}

/**
 * The service's density grid as a DensityGrid for `detections`.
 *
 * All of them: cells, coverage and levels exactly as the service sent them.
 * A subset (map filters): each cell's debris is the sum of the shown detections' areas as the
 * service measured them, graded with the service's thresholds; cells left without debris are empty.
 */
export function densityGridFromService(
  grid: ServiceDensityGrid,
  detections: readonly Identified[],
  bounds: GeoBounds,
): DensityGrid {
  const shown = new Set(detections.map((d) => d.id))
  const complete = coversServiceDetections(grid, detections)
  const listed = new Map(grid.cells.map((cell) => [cellIndex(grid, cell.row, cell.col), cell]))

  const cells: DensityCell[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = listed.get(cellIndex(grid, row, col))
      cells.push(
        cell ? measuredCell(cell, shown, complete, grid) : emptyCell(grid, bounds, row, col),
      )
    }
  }

  // A detection's level: the cell holding most of its area (the first such cell, south to north).
  const detectionLevels: Record<string, DensityLevel> = {}
  const largest = new Map<string, number>()
  for (const cell of cells) {
    if (!cell.level) continue
    const source = listed.get(cellIndex(grid, cell.row, cell.col))
    for (const id of cell.detectionIds) {
      const area = source?.detectionAreasM2[id] ?? 0
      if (area > (largest.get(id) ?? 0)) {
        largest.set(id, area)
        detectionLevels[id] = cell.level
      }
    }
  }

  return {
    source: 'service',
    bounds,
    cellSizeM: grid.cellSizeM,
    rows: grid.rows,
    cols: grid.cols,
    cells,
    detectionLevels,
  }
}
