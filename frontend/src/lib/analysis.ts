import type { Observation } from '@/features/observations/types'
import { gridCellSizeForResolution } from '@/lib/config'
import { computeDensityGrid, type DensityGrid } from '@/lib/density'
import { boundsOfGeometries } from '@/lib/geo'
import { findHotspots, type Hotspot } from '@/lib/hotspots'
import { computeObservationStats, type ObservationStats } from '@/lib/stats'

export interface ObservationAnalysis {
  /** Null when there is nothing to grid: no bounds and no detections. */
  grid: DensityGrid | null
  hotspots: Hotspot[]
  stats: ObservationStats
}

/**
 * Grid, hotspots and stats for one observation, in one call.
 * Without image bounds (partial georeferencing), the grid covers the detections' extent.
 */
export function analyzeObservation(
  observation: Pick<Observation, 'detections' | 'bounds' | 'resolutionM'>,
): ObservationAnalysis {
  const { detections } = observation
  const bounds = observation.bounds ?? boundsOfGeometries(detections.map((d) => d.geometry))
  const grid = bounds
    ? computeDensityGrid(detections, bounds, gridCellSizeForResolution(observation.resolutionM))
    : null
  const hotspots = grid ? findHotspots(grid, detections) : []
  return { grid, hotspots, stats: computeObservationStats(detections, hotspots) }
}
