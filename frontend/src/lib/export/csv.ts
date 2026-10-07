/**
 * CSV exports (RFC 4180): CRLF line endings, fields quoted when they contain a comma, a quote or a
 * line break, quotes doubled. A UTF-8 byte order mark lets Excel read accents and "m²" correctly.
 */
import type { Detection, Observation } from '@/features/observations/types'

export const UTF8_BOM = '﻿'
const CRLF = '\r\n'

/** Text that a spreadsheet would run as a formula ("=", "+", "-", "@" or a control first). */
const FORMULA_START = /^[=+\-@\t\r]/

export type CsvValue = string | number | null | undefined

/**
 * One field. Text that would start a spreadsheet formula gets a leading apostrophe, so a region
 * named "=HYPERLINK(...)" stays text. Numbers are written as given.
 */
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Header plus rows, CRLF-terminated, with the BOM. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(','))
  return `${UTF8_BOM}${lines.join(CRLF)}${CRLF}`
}

/** Rounds to a fixed number of decimals without float noise ("0.30000000000000004"). */
export function round(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return Number.NaN
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export const DETECTION_CSV_COLUMNS = [
  'id',
  'observation_id',
  'region',
  'source',
  'captured_at',
  'lat',
  'lng',
  'area_m2',
  'area_ha',
  'confidence',
  'density_level',
  'source_pixels',
] as const

/**
 * One row per detection. Precision: coordinates 6 decimals (about 0.1 m), area 2 decimals in m²
 * and 6 in hectares, confidence 3 decimals.
 */
export function detectionsCsv(
  observation: Pick<Observation, 'id' | 'region' | 'source' | 'capturedAt'>,
  detections: readonly Detection[],
): string {
  return toCsv(
    DETECTION_CSV_COLUMNS,
    detections.map((d) => [
      d.id,
      observation.id,
      observation.region,
      observation.source,
      observation.capturedAt,
      round(d.centroid.lat, 6),
      round(d.centroid.lng, 6),
      round(d.areaM2, 2),
      round(d.areaM2 / 10_000, 6),
      round(d.confidence, 3),
      d.densityLevel,
      d.sourcePixelCount,
    ]),
  )
}
