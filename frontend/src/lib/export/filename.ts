import type { Observation } from '@/features/observations/types'
import { slugify } from '@/lib/format'

export type ExportExtension = 'geojson' | 'csv' | 'pdf'

/** UTC calendar date of the capture, YYYY-MM-DD, or "undated" when the timestamp is unreadable. */
function captureDay(capturedAt: string): string {
  const date = new Date(capturedAt)
  return Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10)
}

/**
 * "marine-debris_ennore-coast-bay-of-bengal_2026-10-03.geojson". A `kind` suffix keeps two files of
 * the same type apart ("..._hotspots.geojson", "..._report.pdf").
 */
export function exportFileName(
  observation: Pick<Observation, 'region' | 'capturedAt'>,
  extension: ExportExtension,
  kind?: string,
): string {
  const region = slugify(observation.region) || 'observation'
  const suffix = kind ? `_${slugify(kind)}` : ''
  return `marine-debris_${region}_${captureDay(observation.capturedAt)}${suffix}.${extension}`
}

/** The same name without its extension, for the browser's "Save as PDF" title. */
export function exportBaseName(
  observation: Pick<Observation, 'region' | 'capturedAt'>,
  kind?: string,
): string {
  return exportFileName(observation, 'pdf', kind).replace(/\.pdf$/, '')
}
