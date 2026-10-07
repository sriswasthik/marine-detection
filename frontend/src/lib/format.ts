import type { LatLng } from '@/features/observations/types'

/** Shown wherever a value is missing or invalid. */
export const EMPTY_VALUE = '—'

/** Figures use a fixed locale so numbers read the same on every machine during a demo. */
const NUMBER_LOCALE = 'en-US'

const isUsable = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function formatNumber(value: number, maximumFractionDigits: number, minimumFractionDigits = 0) {
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value)
}

export function formatInteger(value: number | null | undefined): string {
  return isUsable(value) ? formatNumber(Math.round(value), 0) : EMPTY_VALUE
}

/** Length: "2.5 m", "250 m", "1.2 km". */
export function formatLength(meters: number | null | undefined): string {
  if (!isUsable(meters) || meters < 0) return EMPTY_VALUE
  if (meters >= 1000) {
    const km = meters / 1000
    return `${formatNumber(km, km < 10 ? 1 : 0)} km`
  }
  if (meters < 10) return `${formatNumber(meters, 1)} m`
  return `${formatNumber(meters, 0)} m`
}

export type AreaUnit = 'auto' | 'm2' | 'ha' | 'km2'

const M2_PER_HA = 10_000
const M2_PER_KM2 = 1_000_000

/** Fraction digits that keep about three significant figures without noise. */
function areaDigits(value: number): number {
  if (value < 10) return 2
  if (value < 100) return 1
  return 0
}

function m2Digits(value: number): number {
  if (value === 0 || value >= 10) return 0
  if (value >= 1) return 1
  return 2
}

/**
 * Area with a unit that fits the size.
 * Auto: square meters under 10,000 m², hectares under 1 km², then square kilometers.
 */
export function formatArea(
  areaM2: number | null | undefined,
  options: { unit?: AreaUnit } = {},
): string {
  if (!isUsable(areaM2) || areaM2 < 0) return EMPTY_VALUE
  const requested = options.unit ?? 'auto'
  const unit: Exclude<AreaUnit, 'auto'> =
    requested !== 'auto'
      ? requested
      : areaM2 < M2_PER_HA
        ? 'm2'
        : areaM2 < M2_PER_KM2
          ? 'ha'
          : 'km2'

  if (unit === 'm2') {
    if (areaM2 > 0 && areaM2 < 0.01) return '<0.01 m²'
    return `${formatNumber(areaM2, m2Digits(areaM2))} m²`
  }
  const value = areaM2 / (unit === 'ha' ? M2_PER_HA : M2_PER_KM2)
  const label = unit === 'ha' ? 'ha' : 'km²'
  if (value > 0 && value < 0.01) return `<0.01 ${label}`
  const digits = areaDigits(value)
  return `${formatNumber(value, digits, digits)} ${label}`
}

/**
 * Coverage with precision that adapts to the size: 12.4%, 0.84%, 0.012%, <0.001%.
 * Input is already a percentage (12.4 means 12.4%).
 */
export function formatCoveragePercent(percent: number | null | undefined): string {
  if (!isUsable(percent) || percent < 0) return EMPTY_VALUE
  if (percent === 0) return '0%'
  if (percent < 0.001) return '<0.001%'
  if (percent < 0.1) return `${formatNumber(percent, 3, 3)}%`
  if (percent < 1) return `${formatNumber(percent, 2, 2)}%`
  return `${formatNumber(percent, 1, 1)}%`
}

/** Confidence from 0-1 to a whole percent: 0.87 becomes "87%". */
export function formatConfidence(confidence: number | null | undefined): string {
  if (!isUsable(confidence)) return EMPTY_VALUE
  const clamped = Math.min(1, Math.max(0, confidence))
  return `${Math.round(clamped * 100)}%`
}

export type CoordinateFormat = 'decimal' | 'dms'

function decimalPart(value: number, positive: string, negative: string, digits: number) {
  return `${Math.abs(value).toFixed(digits)}° ${value < 0 ? negative : positive}`
}

function dmsPart(value: number, positive: string, negative: string) {
  const absolute = Math.abs(value)
  let degrees = Math.floor(absolute)
  let minutes = Math.floor((absolute - degrees) * 60)
  let seconds = Math.round(((absolute - degrees) * 60 - minutes) * 60 * 10) / 10
  if (seconds >= 60) {
    seconds = 0
    minutes += 1
  }
  if (minutes >= 60) {
    minutes = 0
    degrees += 1
  }
  return `${degrees}°${String(minutes).padStart(2, '0')}′${seconds.toFixed(1).padStart(4, '0')}″ ${
    value < 0 ? negative : positive
  }`
}

/** "13.22150° N, 80.36210° E" or, with format "dms", "13°13′17.4″ N, 80°21′43.6″ E". */
export function formatCoordinates(
  point: LatLng | null | undefined,
  options: { format?: CoordinateFormat; digits?: number } = {},
): string {
  if (!point || !isUsable(point.lat) || !isUsable(point.lng)) return EMPTY_VALUE
  if (options.format === 'dms') {
    return `${dmsPart(point.lat, 'N', 'S')}, ${dmsPart(point.lng, 'E', 'W')}`
  }
  const digits = options.digits ?? 5
  return `${decimalPart(point.lat, 'N', 'S', digits)}, ${decimalPart(point.lng, 'E', 'W', digits)}`
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

interface DateOptions {
  /** BCP 47 locale. Defaults to the viewer's locale. */
  locale?: string
  /** IANA time zone. Defaults to the viewer's zone. */
  timeZone?: string
}

/** "3 Oct 2026, 10:36 GMT+5:30" style, in the viewer's locale, with a time zone. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options: DateOptions = {},
): string {
  const date = toDate(value)
  if (!date) return EMPTY_VALUE
  return new Intl.DateTimeFormat(options.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: options.timeZone,
  }).format(date)
}

export function formatDate(
  value: string | number | Date | null | undefined,
  options: DateOptions = {},
): string {
  const date = toDate(value)
  if (!date) return EMPTY_VALUE
  return new Intl.DateTimeFormat(options.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: options.timeZone,
  }).format(date)
}

/** "450 ms", "8.2 s", "2 min 05 s", "1 h 04 min". */
export function formatDuration(ms: number | null | undefined): string {
  if (!isUsable(ms) || ms < 0) return EMPTY_VALUE
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) {
    const seconds = ms / 1000
    return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`
  }
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes} min ${String(seconds).padStart(2, '0')} s`
  }
  const totalMinutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

/** A running clock in whole seconds: "0 s", "12 s", "2 min 05 s". */
export function formatElapsed(ms: number | null | undefined): string {
  if (!isUsable(ms) || ms < 0) return EMPTY_VALUE
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} s`
  return formatDuration(totalSeconds * 1000)
}

/** Last segment of an id, for compact display: "obs-ennore-20261003-d012" becomes "d012". */
export function shortId(id: string): string {
  const parts = id.split('-').filter(Boolean)
  return parts[parts.length - 1] ?? id
}

/** Lowercase, ASCII, hyphen-separated: "Ennore coast, Bay of Bengal" becomes "ennore-coast-bay-of-bengal". */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
