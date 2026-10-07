/**
 * App settings: the shape, the defaults, and how stored JSON is read back. Pure, so every path
 * (missing, corrupt, older version, out-of-range values) is unit tested. Storage I/O lives in
 * src/features/settings/settingsStore.ts.
 */
import type { CoordinateFormat, AreaUnit } from './format'
import { BASEMAP_ORDER, DEFAULT_BASEMAP, type BasemapId } from './map/basemaps'
import { DEFAULT_VISIBLE_LAYERS, MAP_LAYER_IDS, type VisibleLayers } from './map/layers'

export const AREA_UNITS: readonly AreaUnit[] = ['auto', 'm2', 'ha', 'km2']
export const COORDINATE_FORMATS: readonly CoordinateFormat[] = ['decimal', 'dms']
export const AREA_UNIT_LABELS: Readonly<Record<AreaUnit, string>> = {
  auto: 'Auto',
  m2: 'm²',
  ha: 'ha',
  km2: 'km²',
}
export const COORDINATE_FORMAT_LABELS: Readonly<Record<CoordinateFormat, string>> = {
  decimal: 'Decimal degrees',
  dms: 'Degrees, minutes, seconds',
}
export const DATA_SOURCES = ['mock', 'live'] as const
export type DataSource = (typeof DATA_SOURCES)[number]

export interface AppSettings {
  /** Unit for areas everywhere. Auto picks m², ha or km² to fit each figure. */
  areaUnit: AreaUnit
  coordinateFormat: CoordinateFormat
  /** Map defaults, used when a map link does not say otherwise. */
  defaultBasemap: BasemapId
  /** 0 to 1. */
  defaultMinConfidence: number
  defaultLayers: VisibleLayers
  dataSource: DataSource
  /** Base URL of the live processing service, without a trailing slash. */
  apiBaseUrl: string
}

/** The stored format. Bump the version and add a step to `migrate` when the shape changes. */
export const SETTINGS_VERSION = 2
export const SETTINGS_STORAGE_KEY = 'mwi.settings'
/** Version 1 lived under this key as `{ areaUnit }`, without a version field. */
export const LEGACY_PREFERENCES_KEY = 'mwi.preferences'

export interface StoredSettings {
  version: typeof SETTINGS_VERSION
  settings: AppSettings
}

export function defaultSettings(env: { useMock: boolean; apiBaseUrl: string }): AppSettings {
  return {
    areaUnit: 'auto',
    coordinateFormat: 'decimal',
    defaultBasemap: DEFAULT_BASEMAP,
    defaultMinConfidence: 0,
    defaultLayers: DEFAULT_VISIBLE_LAYERS,
    dataSource: env.useMock ? 'mock' : 'live',
    apiBaseUrl: env.apiBaseUrl,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const oneOf = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback

/** Keeps every valid field and replaces anything missing or invalid with its default. */
export function sanitizeSettings(input: unknown, defaults: AppSettings): AppSettings {
  if (!isRecord(input)) return defaults
  const confidence = input.defaultMinConfidence
  const layersInput = isRecord(input.defaultLayers) ? input.defaultLayers : {}
  const url = typeof input.apiBaseUrl === 'string' ? validateApiBaseUrl(input.apiBaseUrl) : null
  return {
    areaUnit: oneOf(AREA_UNITS, input.areaUnit, defaults.areaUnit),
    coordinateFormat: oneOf(COORDINATE_FORMATS, input.coordinateFormat, defaults.coordinateFormat),
    defaultBasemap: oneOf(BASEMAP_ORDER, input.defaultBasemap, defaults.defaultBasemap),
    defaultMinConfidence:
      typeof confidence === 'number' && Number.isFinite(confidence)
        ? Math.min(1, Math.max(0, Math.round(confidence * 100) / 100))
        : defaults.defaultMinConfidence,
    defaultLayers: Object.fromEntries(
      MAP_LAYER_IDS.map((id) => [
        id,
        typeof layersInput[id] === 'boolean' ? layersInput[id] : defaults.defaultLayers[id],
      ]),
    ) as unknown as VisibleLayers,
    dataSource: oneOf(DATA_SOURCES, input.dataSource, defaults.dataSource),
    apiBaseUrl: url?.ok ? url.url : defaults.apiBaseUrl,
  }
}

export type ReadResult = {
  settings: AppSettings
  /** What happened, for logging and tests. */
  status: 'default' | 'current' | 'migrated' | 'corrupt'
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false }
  }
}

/**
 * Reads stored settings. Current-version data is sanitised; version 1 (the old preferences key)
 * is migrated; anything unreadable falls back to the defaults. Never throws.
 */
export function readSettings(
  stored: { current: string | null; legacy: string | null },
  defaults: AppSettings,
): ReadResult {
  if (stored.current !== null) {
    const parsed = parseJson(stored.current)
    if (!parsed.ok || !isRecord(parsed.value)) return { settings: defaults, status: 'corrupt' }
    const { version, settings } = parsed.value
    if (version === SETTINGS_VERSION) {
      return { settings: sanitizeSettings(settings, defaults), status: 'current' }
    }
    if (version === 1) return { settings: migrateV1(parsed.value, defaults), status: 'migrated' }
    // A newer or unknown version: do not guess at its meaning.
    return { settings: defaults, status: 'corrupt' }
  }
  if (stored.legacy !== null) {
    const parsed = parseJson(stored.legacy)
    if (!parsed.ok) return { settings: defaults, status: 'corrupt' }
    return { settings: migrateV1(parsed.value, defaults), status: 'migrated' }
  }
  return { settings: defaults, status: 'default' }
}

/** Version 1 held only the area unit. */
function migrateV1(value: unknown, defaults: AppSettings): AppSettings {
  const areaUnit = isRecord(value) ? value.areaUnit : undefined
  return { ...defaults, areaUnit: oneOf(AREA_UNITS, areaUnit, defaults.areaUnit) }
}

export function serializeSettings(settings: AppSettings): string {
  const stored: StoredSettings = { version: SETTINGS_VERSION, settings }
  return JSON.stringify(stored)
}

/**
 * Checks a service base URL: http or https, with a host. Returns it without a trailing slash, or
 * a message saying what to fix.
 */
export function validateApiBaseUrl(
  input: string,
): { ok: true; url: string } | { ok: false; message: string } {
  const text = input.trim()
  if (text === '') return { ok: false, message: 'Enter the address of the processing service.' }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return {
      ok: false,
      message:
        'Enter a full address that starts with http:// or https://, for example http://localhost:8000.',
    }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: 'Use an http:// or https:// address.' }
  }
  if (url.search || url.hash) {
    return {
      ok: false,
      message: 'Leave out query strings and # fragments; enter the base address only.',
    }
  }
  return { ok: true, url: `${url.origin}${url.pathname}`.replace(/\/+$/, '') }
}
