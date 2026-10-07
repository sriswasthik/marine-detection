import type { DensityLevel, Detection, GeoBounds, LatLng } from '@/features/observations/types'
import { getCell, maxDensityLevel, type DensityCell, type DensityGrid } from '@/lib/density'
import { boundsCenter, unionBounds } from '@/lib/geo'

/** Weight of each level in the priority score. */
export const HOTSPOT_LEVEL_WEIGHTS: Readonly<Record<DensityLevel, number>> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
}

/** Plain-language rule for the priority score tooltip. */
export const PRIORITY_SCORE_RULE =
  'Priority score = debris area in the hotspot (m²) × mean detection confidence × level weight (Low 1, Moderate 2, High 3, Critical 4). Higher scores are cleaned up first.'

/** The same rule in plain words, for the inspection panel. */
export const PRIORITY_SCORE_EXPLANATION =
  'Hotspots are ranked by priority score: the debris area inside the hotspot, times the average model confidence, times a weight for the density level (Low 1, Moderate 2, High 3, Critical 4). Larger, denser and more certain hotspots come first.'

export interface Hotspot {
  /** `hotspot-{rank}`. */
  id: string
  /** 1 is the highest priority. */
  rank: number
  /** Highest level among the hotspot's cells. */
  level: DensityLevel
  bounds: GeoBounds
  /** Debris-area-weighted centre of the hotspot's cells. */
  centroid: LatLng
  cellIds: string[]
  /** Detections with any area inside the hotspot's cells. */
  detectionIds: string[]
  /** Debris area inside the hotspot's cells, square meters. */
  totalAreaM2: number
  /** Mean confidence of the hotspot's detections, 0 to 1. */
  meanConfidence: number
  /** totalAreaM2 × meanConfidence × HOTSPOT_LEVEL_WEIGHTS[level]. */
  priorityScore: number
}

const NEIGHBOUR_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const

export function priorityScore(totalAreaM2: number, meanConfidence: number, level: DensityLevel) {
  return totalAreaM2 * meanConfidence * HOTSPOT_LEVEL_WEIGHTS[level]
}

/**
 * Groups adjacent grid cells (8-neighbour flood fill) into hotspots.
 *
 * Cells at High or Critical form hotspots. If there are none, Moderate cells form them instead.
 * An observation with only Low cells, or no debris at all, has no hotspots.
 * Results are sorted by priority score, highest first.
 */
export function findHotspots(grid: DensityGrid, detections: readonly Detection[]): Hotspot[] {
  const severe = new Set<DensityLevel>(['high', 'critical'])
  const hasSevere = grid.cells.some((cell) => cell.level && severe.has(cell.level))
  const hasModerate = grid.cells.some((cell) => cell.level === 'moderate')
  const eligibleLevels: ReadonlySet<DensityLevel> = hasSevere
    ? severe
    : hasModerate
      ? new Set<DensityLevel>(['moderate'])
      : new Set<DensityLevel>()
  if (eligibleLevels.size === 0) return []

  const isEligible = (cell: DensityCell | undefined): cell is DensityCell =>
    Boolean(cell?.level && eligibleLevels.has(cell.level))

  const confidenceById = new Map(detections.map((d) => [d.id, d.confidence]))
  const visited = new Set<string>()
  const groups: DensityCell[][] = []

  for (const start of grid.cells) {
    if (!isEligible(start) || visited.has(start.id)) continue
    const group: DensityCell[] = []
    const stack: DensityCell[] = [start]
    visited.add(start.id)
    while (stack.length > 0) {
      const cell = stack.pop()
      if (!cell) break
      group.push(cell)
      for (const [dr, dc] of NEIGHBOUR_OFFSETS) {
        const next = getCell(grid, cell.row + dr, cell.col + dc)
        if (isEligible(next) && !visited.has(next.id)) {
          visited.add(next.id)
          stack.push(next)
        }
      }
    }
    groups.push(group)
  }

  const unranked = groups.map((cells) => {
    const level = maxDensityLevel(cells.map((c) => c.level)) ?? 'low'
    const totalAreaM2 = cells.reduce((sum, c) => sum + c.debrisAreaM2, 0)
    const detectionIds = [...new Set(cells.flatMap((c) => c.detectionIds))].sort()
    const confidences = detectionIds
      .map((id) => confidenceById.get(id))
      .filter((c): c is number => c !== undefined)
    const meanConfidence =
      confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0

    let bounds = cells[0]?.bounds ?? grid.bounds
    let weightedLat = 0
    let weightedLng = 0
    for (const cell of cells) {
      bounds = unionBounds(bounds, cell.bounds)
      const center = boundsCenter(cell.bounds)
      weightedLat += center.lat * cell.debrisAreaM2
      weightedLng += center.lng * cell.debrisAreaM2
    }
    const centroid =
      totalAreaM2 > 0
        ? { lat: weightedLat / totalAreaM2, lng: weightedLng / totalAreaM2 }
        : boundsCenter(bounds)

    return {
      level,
      bounds,
      centroid,
      cellIds: cells.map((c) => c.id).sort(),
      detectionIds,
      totalAreaM2,
      meanConfidence,
      priorityScore: priorityScore(totalAreaM2, meanConfidence, level),
    }
  })

  return unranked
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((hotspot, index) => ({ id: `hotspot-${index + 1}`, rank: index + 1, ...hotspot }))
}
