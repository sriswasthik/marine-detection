import type { DensityLevel } from '@/features/observations/types'
import { maxDensityLevel } from '@/lib/density'

/**
 * Low-zoom centroid markers: up to CLUSTER_THRESHOLD visible markers are drawn one by one; above
 * it, three or more markers that fall in the same CLUSTER_CELL_PX screen cell merge into one
 * counted cluster coloured by its most severe level (a pair stays as two squares: a "2" badge is
 * noise). Pure and Leaflet-free: the caller projects to screen pixels.
 */

export const CLUSTER_THRESHOLD = 40
export const CLUSTER_CELL_PX = 48
export const MIN_CLUSTER_SIZE = 3

export interface ScreenPoint {
  id: string
  /** Container pixels. */
  x: number
  y: number
  level: DensityLevel
}

export interface PointCluster {
  /** Stable for the same members: the sorted member ids joined. */
  id: string
  x: number
  y: number
  count: number
  level: DensityLevel
  ids: string[]
}

export interface ClusterResult {
  singles: ScreenPoint[]
  clusters: PointCluster[]
}

export function clusterPoints(
  points: readonly ScreenPoint[],
  { threshold = CLUSTER_THRESHOLD, cellPx = CLUSTER_CELL_PX, minSize = MIN_CLUSTER_SIZE } = {},
): ClusterResult {
  if (points.length <= threshold) return { singles: [...points], clusters: [] }
  const cells = new Map<string, ScreenPoint[]>()
  for (const point of points) {
    const key = `${Math.floor(point.x / cellPx)}:${Math.floor(point.y / cellPx)}`
    const cell = cells.get(key)
    if (cell) cell.push(point)
    else cells.set(key, [point])
  }
  const singles: ScreenPoint[] = []
  const clusters: PointCluster[] = []
  for (const members of cells.values()) {
    if (members.length < minSize) {
      singles.push(...members)
      continue
    }
    const ids = members.map((m) => m.id).sort()
    clusters.push({
      id: ids.join('|'),
      x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
      y: members.reduce((sum, m) => sum + m.y, 0) / members.length,
      count: members.length,
      level: maxDensityLevel(members.map((m) => m.level)) ?? 'low',
      ids,
    })
  }
  return { singles, clusters }
}
