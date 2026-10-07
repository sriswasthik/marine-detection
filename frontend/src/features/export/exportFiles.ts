import { isMockMode } from '@/features/observations/api'
import type { Detection, Observation } from '@/features/observations/types'
import type { ObservationAnalysis } from '@/lib/analysis'
import { ENV } from '@/lib/env'
import { detectionsCsv } from '@/lib/export/csv'
import { exportFileName } from '@/lib/export/filename'
import {
  detectionFeature,
  detectionsCollection,
  hotspotsCollection,
  toGeoJsonText,
  type ExportScope,
} from '@/lib/export/geojson'

/** What to export: the observation, the shown subset and the analysis made from that subset. */
export interface ExportSource {
  /** The whole observation, for summary metrics. */
  observation: Observation
  /** The detections to export: all of them, or the map's filtered list. */
  detections: readonly Detection[]
  /** Hotspots and grid computed from `detections`. */
  analysis: ObservationAnalysis
  /** Active map filters in plain words, or null. */
  filters: string | null
}

export interface ExportFile {
  filename: string
  text: string
  mimeType: string
}

function scope(source: ExportSource): ExportScope {
  return {
    generatedAt: new Date().toISOString(),
    generator: ENV.appName,
    sampleData: isMockMode(),
    filters: source.filters,
  }
}

const GEOJSON = 'application/geo+json'

export function detectionsGeoJsonFile(source: ExportSource): ExportFile {
  return {
    filename: exportFileName(source.observation, 'geojson'),
    text: toGeoJsonText(
      detectionsCollection(source.observation, {
        detections: source.detections,
        hotspotCount: source.analysis.hotspots.length,
        scope: scope(source),
      }),
    ),
    mimeType: GEOJSON,
  }
}

export function hotspotsGeoJsonFile(source: ExportSource): ExportFile {
  return {
    filename: exportFileName(source.observation, 'geojson', 'hotspots'),
    text: toGeoJsonText(
      hotspotsCollection(source.observation, {
        hotspots: source.analysis.hotspots,
        grid: source.analysis.grid,
        scope: scope(source),
      }),
    ),
    mimeType: GEOJSON,
  }
}

export function detectionsCsvFile(source: ExportSource): ExportFile {
  return {
    filename: exportFileName(source.observation, 'csv'),
    text: detectionsCsv(source.observation, source.detections),
    mimeType: 'text/csv',
  }
}

export function singleDetectionFile(observation: Observation, detection: Detection): ExportFile {
  return {
    filename: exportFileName(observation, 'geojson', detection.id.split('-').pop() ?? 'detection'),
    text: toGeoJsonText(detectionFeature(detection, observation)),
    mimeType: GEOJSON,
  }
}
