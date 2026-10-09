/**
 * Derived figures for the observation detail page. Every value is already formatted and safe for
 * a no-debris result: counts and areas are real zeros, and nothing ever reads "NaN".
 */
import type { DensityLevel, Detection, GeoBounds, Observation } from '@/features/observations/types'
import { DENSITY_LEVEL_ORDER, DENSITY_LEVELS } from './density'
import {
  EMPTY_VALUE,
  formatArea,
  formatConfidence,
  formatCoveragePercent,
  formatDateTime,
  formatDuration,
  formatInteger,
  formatLatitude,
  formatLongitude,
  type AreaUnit,
} from './format'
import { boundsAreaM2, boundsOfGeometries } from './geo'
import type { LevelBreakdown } from './stats'

export type EvidenceMetricId =
  'debrisArea' | 'waterArea' | 'coverage' | 'confidence' | 'detections' | 'hotspots'

export interface EvidenceMetric {
  id: EvidenceMetricId
  label: string
  value: string
  /** How the figure is computed, for the tooltip. */
  hint: string
  footnote?: string
}

/** The six headline figures, with areas in the chosen unit. */
export function evidenceMetrics(
  observation: Pick<
    Observation,
    'debrisAreaM2' | 'waterAreaM2' | 'coveragePercent' | 'averageConfidence' | 'detections'
  >,
  hotspotCount: number,
  /** Defaults to the person's area unit setting. */
  unit?: AreaUnit,
): EvidenceMetric[] {
  const count = observation.detections.length
  return [
    {
      id: 'debrisArea',
      label: 'Detected area',
      value: formatArea(observation.debrisAreaM2, { unit }),
      hint: 'Sum of the areas of every detected region, measured from its outline on the map.',
    },
    {
      id: 'waterArea',
      label: 'Water area',
      value: formatArea(observation.waterAreaM2, { unit }),
      hint: 'Water surface the model analysed in this image, as reported by the processing service.',
    },
    {
      id: 'coverage',
      label: 'Coverage',
      value: formatCoveragePercent(observation.coveragePercent),
      hint: 'Coverage = detected area / water area.',
    },
    {
      id: 'confidence',
      label: 'Average confidence',
      value:
        observation.averageConfidence === null
          ? EMPTY_VALUE
          : formatConfidence(observation.averageConfidence),
      hint: 'Mean model confidence across all detected regions.',
      footnote: count === 0 ? 'No detections to average' : undefined,
    },
    {
      id: 'detections',
      label: 'Detected regions',
      value: formatInteger(count),
      hint: 'Number of separate debris regions the model outlined in the image.',
    },
    {
      id: 'hotspots',
      label: 'Hotspots',
      value: formatInteger(hotspotCount),
      hint: 'Clusters of neighbouring grid cells at High or Critical density, or Moderate when nothing is higher. Each one is worth an inspection.',
      footnote: hotspotCount === 0 && count > 0 ? 'None stands out' : undefined,
    },
  ]
}

export interface DensityShareSegment {
  level: DensityLevel
  label: string
  areaM2: number
  detectionCount: number
  /** Share of total debris area, 0 to 100. Together the segments make 100 when there is debris. */
  percent: number
  /** Rounded for the legend, never "0%" for a level that has some debris. */
  percentLabel: string
}

/**
 * Share of debris area per density level, Low to Critical, for the stacked bar. Levels without
 * debris are kept (the legend lists all four) with a zero share. No debris at all gives four zeros.
 */
export function densityShares(byLevel: readonly LevelBreakdown[]): DensityShareSegment[] {
  const total = byLevel.reduce((sum, entry) => sum + entry.areaM2, 0)
  return DENSITY_LEVEL_ORDER.map((level) => {
    const entry = byLevel.find((item) => item.level === level)
    const areaM2 = entry?.areaM2 ?? 0
    const percent = total > 0 ? (areaM2 / total) * 100 : 0
    return {
      level,
      label: DENSITY_LEVELS[level].label,
      areaM2,
      detectionCount: entry?.detectionCount ?? 0,
      percent,
      percentLabel: percent === 0 ? '0%' : percent < 1 ? '<1%' : `${Math.round(percent)}%`,
    }
  })
}

/** Plain-language reading of the observation-level density. */
export function densitySummaryText(level: DensityLevel | null, detectionCount: number): string {
  if (detectionCount === 0 || level === null) {
    return 'No debris was detected, so there is no density level for this image.'
  }
  return `${DENSITY_LEVELS[level].meaning}. This is the highest level reached by any grid cell in the image.`
}

export interface FactRow {
  label: string
  value: string
  /** Coordinates and ids use the monospace face. */
  mono?: boolean
  /** Plain-language explanation of the label (see lib/glossary.ts). */
  hint?: string
}

const NOT_RECORDED = 'Not recorded'

/** Where density levels and hotspots were computed, for the provenance rows. */
export function densitySourceText(observation: Pick<Observation, 'densityGrid'>): string {
  const grid = observation.densityGrid
  if (!grid) return 'Computed in this browser from the detection outlines'
  const cell = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(grid.cellSizeM)
  return `Measured by the analysis service on ${cell} m cells of model pixels`
}

/** Model, timing, resolution and source facts. Missing fields read "Not recorded". */
export function provenanceRows(
  observation: Pick<
    Observation,
    'id' | 'processing' | 'resolutionM' | 'cloudCoveragePercent' | 'densityGrid'
  >,
): FactRow[] {
  const processing = observation.processing
  const started = processing ? Date.parse(processing.startedAt) : Number.NaN
  const finished = processing ? Date.parse(processing.finishedAt) : Number.NaN
  const durationMs = finished - started
  const resolution = observation.resolutionM
  return [
    {
      label: 'Model',
      value: processing ? `${processing.modelName} ${processing.modelVersion}` : NOT_RECORDED,
    },
    {
      label: 'Processing started',
      value: processing ? formatDateTime(processing.startedAt) : NOT_RECORDED,
    },
    {
      label: 'Processing finished',
      value: processing ? formatDateTime(processing.finishedAt) : NOT_RECORDED,
    },
    {
      label: 'Duration',
      value:
        Number.isFinite(durationMs) && durationMs >= 0 ? formatDuration(durationMs) : NOT_RECORDED,
    },
    {
      label: 'Resolution',
      value:
        resolution !== undefined && Number.isFinite(resolution) && resolution > 0
          ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(resolution)} m per pixel`
          : NOT_RECORDED,
    },
    {
      label: 'Cloud coverage',
      value:
        observation.cloudCoveragePercent === undefined
          ? NOT_RECORDED
          : formatCoveragePercent(observation.cloudCoveragePercent),
    },
    { label: 'Density and hotspots', value: densitySourceText(observation) },
    { label: 'Source ID', value: observation.id, mono: true },
  ]
}

/** "13.24020° N" style edge values, plus the footprint area in square kilometers. */
export function extentFacts(observation: Pick<Observation, 'bounds' | 'crs'>): {
  edges: FactRow[]
  crs: string
  footprintArea: string
} {
  const b = observation.bounds
  return {
    edges: [
      { label: 'North', value: formatLatitude(b?.north), mono: true },
      { label: 'South', value: formatLatitude(b?.south), mono: true },
      { label: 'East', value: formatLongitude(b?.east), mono: true },
      { label: 'West', value: formatLongitude(b?.west), mono: true },
    ],
    crs: observation.crs ?? 'Not available',
    footprintArea: b ? formatArea(boundsAreaM2(b), { unit: 'km2' }) : EMPTY_VALUE,
  }
}

/** The detection named by ?detection=, or null when the parameter is missing or unknown. */
export function detectionFromParam(
  detections: readonly Pick<Detection, 'id'>[],
  param: string | null,
): string | null {
  const id = param?.trim()
  if (!id) return null
  return detections.some((d) => d.id === id) ? id : null
}

export interface EvidenceSource {
  /** Bounds the evidence views are fitted to. Null when the image cannot be placed at all. */
  bounds: GeoBounds | null
  /** Georeferenced preview image to draw on the bounds, or null to fall back to basemap imagery. */
  previewUrl: string | null
  /** Shown under the viewer whenever it is not showing the source image itself. */
  caption: string | null
}

/**
 * What the evidence viewer can draw. The source preview needs both a URL and image bounds; without
 * it the viewer shows satellite basemap imagery fitted to the same bounds, and says so.
 */
export function evidenceSource(
  observation: Pick<Observation, 'previewUrl' | 'bounds' | 'detections'>,
  options: { sampleData: boolean },
): EvidenceSource {
  const detectionBounds = boundsOfGeometries(observation.detections.map((d) => d.geometry))
  const bounds = observation.bounds ?? detectionBounds
  const url = observation.previewUrl.trim()
  if (url && observation.bounds) return { bounds, previewUrl: url, caption: null }
  if (!bounds) return { bounds: null, previewUrl: null, caption: null }
  const parts = [
    options.sampleData
      ? 'Showing basemap imagery. Source preview not available for sample data.'
      : 'Showing basemap imagery. Source preview not available.',
  ]
  if (!observation.bounds)
    parts.push('Image bounds are unknown, so the view is fitted to the detections.')
  return { bounds, previewUrl: null, caption: parts.join(' ') }
}
