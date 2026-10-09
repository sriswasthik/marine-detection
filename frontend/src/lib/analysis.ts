import type { Observation } from '@/features/observations/types'
import { gridCellSizeForResolution } from '@/lib/config'
import { computeDensityGrid, type DensityGrid } from '@/lib/density'
import { boundsOfGeometries } from '@/lib/geo'
import { findHotspots, type Hotspot } from '@/lib/hotspots'
import { coversServiceDetections, densityGridFromService } from '@/lib/serviceDensity'
import { computeObservationStats, type ObservationStats } from '@/lib/stats'

export interface ObservationAnalysis {
  /** Null when there is nothing to grid: no bounds and no detections. */
  grid: DensityGrid | null
  hotspots: Hotspot[]
  stats: ObservationStats
}

type AnalysisInput = Pick<
  Observation,
  'detections' | 'bounds' | 'resolutionM' | 'densityGrid' | 'hotspots'
>

/**
 * The observation's density grid: the service's when it sent one (real model output), otherwise
 * computed here from the detection polygons (synthetic sample data). Without image bounds
 * (partial georeferencing), a browser grid covers the detections' extent.
 */
export function observationDensityGrid(observation: AnalysisInput): DensityGrid | null {
  const { detections } = observation
  const bounds = observation.bounds ?? boundsOfGeometries(detections.map((d) => d.geometry))
  if (!bounds) return null
  if (observation.densityGrid) {
    return densityGridFromService(observation.densityGrid, detections, bounds)
  }
  return computeDensityGrid(detections, bounds, gridCellSizeForResolution(observation.resolutionM))
}

/**
 * Grid, hotspots and stats for one observation, in one call.
 *
 * Real model output carries the service's grid and ranked hotspots, used as sent. When the
 * detections are a subset of what the service graded (map filters), the hotspots are regrouped
 * here from the service's measured cell areas, with the same rules (src/lib/hotspots.ts).
 */
export function analyzeObservation(observation: AnalysisInput): ObservationAnalysis {
  const { detections } = observation
  const grid = observationDensityGrid(observation)
  const serviceHotspots =
    observation.densityGrid &&
    observation.hotspots &&
    coversServiceDetections(observation.densityGrid, detections)
      ? observation.hotspots
      : null
  const hotspots = serviceHotspots ?? (grid ? findHotspots(grid, detections) : [])
  return { grid, hotspots, stats: computeObservationStats(detections, hotspots) }
}
