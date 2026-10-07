/**
 * Map page state in the URL, so a reload or a shared link restores the exact view.
 * Parsing never throws: anything unreadable falls back to its default.
 *
 *   src=satellite|drone        source filter (omitted: all)
 *   from=YYYY-MM-DD, to=...    capture date range
 *   conf=0..100                minimum confidence in percent (omitted: the Settings default)
 *   lv=high,critical | none    density levels (omitted: all four)
 *   region=Bay of Bengal       region group
 *   d=<detection id>           selected detection
 *   h=<hotspot id>             selected hotspot
 *   bm=satellite               basemap (omitted: the Settings default)
 *   layers=detections,density | none   visible layers (omitted: defaults)
 *   fresh=1                    just arrived from the Analyze flow (removed after use)
 */
import { DENSITY_LEVEL_IDS, type DensityLevel } from '@/features/observations/types'
import { DEFAULT_FILTERS, type MapFilters, type SourceFilter } from './filters'
import { BASEMAP_ORDER, DEFAULT_BASEMAP, type BasemapId } from './map/basemaps'
import {
  DEFAULT_VISIBLE_LAYERS,
  MAP_LAYER_IDS,
  type MapLayerId,
  type VisibleLayers,
} from './map/layers'

export interface MapUrlState {
  filters: MapFilters
  detectionId: string | null
  hotspotId: string | null
  basemap: BasemapId
  layers: VisibleLayers
  fresh: boolean
}

export const DEFAULT_MAP_URL_STATE: MapUrlState = {
  filters: DEFAULT_FILTERS,
  detectionId: null,
  hotspotId: null,
  basemap: DEFAULT_BASEMAP,
  layers: DEFAULT_VISIBLE_LAYERS,
  fresh: false,
}

/**
 * What the map shows when a link does not say: the Settings page defaults. Values equal to these
 * are left out of the URL, so a default view has a clean address.
 */
export interface MapDefaults {
  basemap: BasemapId
  minConfidence: number
  layers: VisibleLayers
}

export const BUILT_IN_MAP_DEFAULTS: MapDefaults = {
  basemap: DEFAULT_BASEMAP,
  minConfidence: 0,
  layers: DEFAULT_VISIBLE_LAYERS,
}

/** The filters "Reset" goes back to: everything, at the default minimum confidence. */
export function baselineFilters(defaults: MapDefaults): MapFilters {
  return { ...DEFAULT_FILTERS, minConfidence: defaults.minConfidence }
}

const MAX_TEXT = 200
const NONE = 'none'

function text(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length <= MAX_TEXT ? trimmed : null
}

function isoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

function confidence(value: string | null, fallback: number): number {
  if (value === null || !/^\d{1,3}$/.test(value.trim())) return fallback
  return Math.min(100, Number(value)) / 100
}

function list<T extends string>(value: string | null, allowed: readonly T[]): T[] | null {
  if (value === null) return null
  if (value.trim() === NONE) return []
  const picked = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is T => (allowed as readonly string[]).includes(item))
  // Keep the canonical order and drop duplicates.
  const unique = allowed.filter((item) => picked.includes(item))
  return unique.length > 0 ? unique : null
}

export function parseMapSearch(
  input: URLSearchParams | string,
  defaults: MapDefaults = BUILT_IN_MAP_DEFAULTS,
): MapUrlState {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input
  const sourceParam = params.get('src')
  const source: SourceFilter =
    sourceParam === 'satellite' || sourceParam === 'drone' ? sourceParam : 'all'

  let dateFrom = isoDate(params.get('from'))
  let dateTo = isoDate(params.get('to'))
  if (dateFrom && dateTo && dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom]

  const levels: readonly DensityLevel[] =
    list(params.get('lv'), DENSITY_LEVEL_IDS) ?? DENSITY_LEVEL_IDS
  const layerList = list<MapLayerId>(params.get('layers'), MAP_LAYER_IDS)
  const layers: VisibleLayers = layerList
    ? (Object.fromEntries(MAP_LAYER_IDS.map((id) => [id, layerList.includes(id)])) as Record<
        MapLayerId,
        boolean
      >)
    : defaults.layers

  const basemapParam = params.get('bm')
  const basemap = (BASEMAP_ORDER as readonly string[]).includes(basemapParam ?? '')
    ? (basemapParam as BasemapId)
    : defaults.basemap

  return {
    filters: {
      source,
      dateFrom,
      dateTo,
      minConfidence: confidence(params.get('conf'), defaults.minConfidence),
      levels,
      region: text(params.get('region')),
    },
    detectionId: text(params.get('d')),
    hotspotId: text(params.get('h')),
    basemap,
    layers,
    fresh: params.get('fresh') === '1',
  }
}

/** Canonical query string: defaults are omitted, so the default view has a clean URL. */
export function serializeMapSearch(
  state: MapUrlState,
  defaults: MapDefaults = BUILT_IN_MAP_DEFAULTS,
): URLSearchParams {
  const params = new URLSearchParams()
  const { filters } = state
  if (filters.source !== 'all') params.set('src', filters.source)
  if (filters.dateFrom) params.set('from', filters.dateFrom)
  if (filters.dateTo) params.set('to', filters.dateTo)
  const percent = Math.round(Math.min(1, Math.max(0, filters.minConfidence)) * 100)
  if (percent !== Math.round(defaults.minConfidence * 100)) params.set('conf', String(percent))
  const levels = DENSITY_LEVEL_IDS.filter((level) => filters.levels.includes(level))
  if (levels.length === 0) params.set('lv', NONE)
  else if (levels.length < DENSITY_LEVEL_IDS.length) params.set('lv', levels.join(','))
  if (filters.region) params.set('region', filters.region)
  if (state.detectionId) params.set('d', state.detectionId)
  if (state.hotspotId) params.set('h', state.hotspotId)
  if (state.basemap !== defaults.basemap) params.set('bm', state.basemap)
  const visible = MAP_LAYER_IDS.filter((id) => state.layers[id])
  const isDefault = MAP_LAYER_IDS.every((id) => state.layers[id] === defaults.layers[id])
  if (!isDefault) params.set('layers', visible.length > 0 ? visible.join(',') : NONE)
  if (state.fresh) params.set('fresh', '1')
  return params
}
