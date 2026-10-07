import type { Position } from 'geojson'
import {
  DENSITY_LEVEL_IDS,
  type DensityLevel,
  type Detection,
  type GeoBounds,
} from '@/features/observations/types'
import { DENSITY_THRESHOLDS, GRID_CELL_SIZE_M } from '@/lib/config'
import { createLocalProjection } from '@/lib/geo'
import { clipRingToRect, openRing, ringArea, ringBBox, type Point } from '@/lib/polygon'

export interface DensityLevelMeta {
  id: DensityLevel
  /** 0 for Low up to 3 for Critical. */
  order: number
  label: string
  /** Fill colour. Mirrors the severity tokens in src/styles/tokens.css (a test keeps them equal). */
  color: string
  stroke: string
  soft: string
  meaning: string
}

export const DENSITY_LEVELS: Readonly<Record<DensityLevel, DensityLevelMeta>> = {
  low: {
    id: 'low',
    order: 0,
    label: 'Low',
    color: '#E8CF7A',
    stroke: '#B8993A',
    soft: '#FAF3D9',
    meaning: 'Small debris coverage',
  },
  moderate: {
    id: 'moderate',
    order: 1,
    label: 'Moderate',
    color: '#E0954F',
    stroke: '#B86D2C',
    soft: '#FAE9D6',
    meaning: 'Meaningful debris presence',
  },
  high: {
    id: 'high',
    order: 2,
    label: 'High',
    color: '#C4503A',
    stroke: '#983728',
    soft: '#F7DDD7',
    meaning: 'Concentrated debris',
  },
  critical: {
    id: 'critical',
    order: 3,
    label: 'Critical',
    color: '#7F2432',
    stroke: '#5C1824',
    soft: '#EBD3D7',
    meaning: 'Priority hotspot',
  },
}

/** Least to most severe. */
export const DENSITY_LEVEL_ORDER: readonly DensityLevel[] = DENSITY_LEVEL_IDS

/** Level for a grid cell's debris coverage, in percent. See DENSITY_THRESHOLDS. */
export function levelForCoverage(coveragePercent: number): DensityLevel {
  if (coveragePercent >= DENSITY_THRESHOLDS.critical) return 'critical'
  if (coveragePercent >= DENSITY_THRESHOLDS.high) return 'high'
  if (coveragePercent >= DENSITY_THRESHOLDS.moderate) return 'moderate'
  return 'low'
}

/** Negative when a is less severe than b. */
export function compareDensityLevels(a: DensityLevel, b: DensityLevel): number {
  return DENSITY_LEVELS[a].order - DENSITY_LEVELS[b].order
}

export function maxDensityLevel(
  levels: Iterable<DensityLevel | null | undefined>,
): DensityLevel | null {
  let result: DensityLevel | null = null
  for (const level of levels) {
    if (level && (result === null || compareDensityLevels(level, result) > 0)) result = level
  }
  return result
}

export interface DensityCell {
  /** `r{row}c{col}`, row 0 at the south edge, column 0 at the west edge. */
  id: string
  row: number
  col: number
  bounds: GeoBounds
  /** Cell area in square meters. Edge cells clipped to the scene can be smaller. */
  areaM2: number
  debrisAreaM2: number
  /** Debris area as a percent of the cell area. */
  coveragePercent: number
  /** Null when the cell holds no debris. */
  level: DensityLevel | null
  /** Detections with any area inside the cell, sorted. */
  detectionIds: string[]
}

export interface DensityGrid {
  bounds: GeoBounds
  cellSizeM: number
  rows: number
  cols: number
  /** Row-major, starting at the south-west corner. */
  cells: DensityCell[]
  /**
   * Level per detection id: the level of the cell holding the largest share of that
   * detection's area. Detections entirely outside the bounds are absent.
   */
  detectionLevels: Record<string, DensityLevel>
}

export type DensityInput = Pick<Detection, 'id' | 'geometry'>

const cellId = (row: number, col: number) => `r${row}c${col}`

/** Tolerance for floating point error when the scene is an exact multiple of the cell size. */
const EDGE_EPSILON_M = 1e-6

/**
 * Bins detections into a regular grid over the bounds and computes debris coverage per cell.
 *
 * Geometry is projected to local meters (equirectangular at the bounds' mid latitude) and
 * clipped exactly against each cell, so a streak crossing a cell edge is split between cells.
 */
export function computeDensityGrid(
  detections: readonly DensityInput[],
  bounds: GeoBounds,
  cellSizeM: number = GRID_CELL_SIZE_M,
): DensityGrid {
  if (!(cellSizeM > 0)) throw new RangeError('Cell size must be a positive number of meters.')

  const midLat = (bounds.north + bounds.south) / 2
  const projection = createLocalProjection({ lat: bounds.south, lng: bounds.west }, midLat)
  const [widthM, heightM] = projection.toMeters([bounds.east, bounds.north])
  const cols = Math.max(1, Math.ceil(widthM / cellSizeM - EDGE_EPSILON_M))
  const rows = Math.max(1, Math.ceil(heightM / cellSizeM - EDGE_EPSILON_M))

  const debris = new Float64Array(rows * cols)
  const ids: Set<string>[] = Array.from({ length: rows * cols }, () => new Set<string>())
  const detectionLevels: Record<string, DensityLevel> = {}
  const dominantCell = new Map<string, { index: number; areaM2: number }>()

  for (const detection of detections) {
    const polygons =
      detection.geometry.type === 'Polygon'
        ? [detection.geometry.coordinates]
        : detection.geometry.coordinates
    const perCell = new Map<number, number>()

    for (const rings of polygons) {
      rings.forEach((ring: Position[], ringIndex) => {
        const projected: Point[] = openRing(ring.map((p) => projection.toMeters(p)))
        if (projected.length < 3) return
        const sign = ringIndex === 0 ? 1 : -1 // Later rings are holes.
        const box = ringBBox(projected)
        const c0 = Math.max(0, Math.floor(box.minX / cellSizeM))
        const c1 = Math.min(cols - 1, Math.floor(box.maxX / cellSizeM))
        const r0 = Math.max(0, Math.floor(box.minY / cellSizeM))
        const r1 = Math.min(rows - 1, Math.floor(box.maxY / cellSizeM))
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const rect = {
              minX: col * cellSizeM,
              minY: row * cellSizeM,
              maxX: Math.min((col + 1) * cellSizeM, widthM),
              maxY: Math.min((row + 1) * cellSizeM, heightM),
            }
            const clipped = clipRingToRect(projected, rect)
            if (clipped.length < 3) continue
            const area = ringArea(clipped)
            if (area <= 0) continue
            const index = row * cols + col
            perCell.set(index, (perCell.get(index) ?? 0) + sign * area)
          }
        }
      })
    }

    for (const [index, area] of perCell) {
      if (area <= 1e-9) continue
      debris[index] = (debris[index] ?? 0) + area
      ids[index]?.add(detection.id)
      const best = dominantCell.get(detection.id)
      if (!best || area > best.areaM2) dominantCell.set(detection.id, { index, areaM2: area })
    }
  }

  const cells: DensityCell[] = []
  const mLat = heightM / (bounds.north - bounds.south || 1)
  const mLng = widthM / (bounds.east - bounds.west || 1)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col
      const x0 = col * cellSizeM
      const y0 = row * cellSizeM
      const x1 = Math.min(x0 + cellSizeM, widthM)
      const y1 = Math.min(y0 + cellSizeM, heightM)
      const areaM2 = (x1 - x0) * (y1 - y0)
      const debrisAreaM2 = debris[index] ?? 0
      const coveragePercent = areaM2 > 0 ? (debrisAreaM2 / areaM2) * 100 : 0
      cells.push({
        id: cellId(row, col),
        row,
        col,
        bounds: {
          south: bounds.south + y0 / mLat,
          north: Math.min(bounds.south + y1 / mLat, bounds.north),
          west: bounds.west + x0 / mLng,
          east: Math.min(bounds.west + x1 / mLng, bounds.east),
        },
        areaM2,
        debrisAreaM2,
        coveragePercent,
        level: debrisAreaM2 > 0 ? levelForCoverage(coveragePercent) : null,
        detectionIds: [...(ids[index] ?? [])].sort(),
      })
    }
  }

  for (const [detectionId, { index }] of dominantCell) {
    const level = cells[index]?.level
    if (level) detectionLevels[detectionId] = level
  }

  return { bounds, cellSizeM, rows, cols, cells, detectionLevels }
}

export function getCell(grid: DensityGrid, row: number, col: number): DensityCell | undefined {
  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return undefined
  return grid.cells[row * grid.cols + col]
}

/**
 * Observation-level density: the highest level among grid cells that contain debris.
 * Null when no cell contains debris (a valid "no debris detected" result).
 */
export function observationDensityLevel(grid: DensityGrid): DensityLevel | null {
  return maxDensityLevel(grid.cells.map((cell) => cell.level))
}
