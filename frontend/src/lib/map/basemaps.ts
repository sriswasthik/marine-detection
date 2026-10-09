export type BasemapId = 'light' | 'satellite' | 'osm'

export interface BasemapConfig {
  id: BasemapId
  label: string
  url: string
  attribution: string
  /** Full credit for printed reports, where there is room to name every source. */
  credit: string
  subdomains?: string
  /** Highest zoom the provider serves; Leaflet upscales tiles beyond it. */
  maxNativeZoom: number
}

/**
 * CARTO Positron, the original choice for "Light". CARTO now answers every request without an
 * API key with a watermarked "API KEY REQUIRED" tile (HTTP 200, so it cannot be detected as a
 * failure). Kept here for when a key is available.
 */
export const CARTO_POSITRON: BasemapConfig = {
  id: 'light',
  label: 'Light',
  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution: '© OpenStreetMap contributors © CARTO',
  credit: 'CARTO Positron: © OpenStreetMap contributors, © CARTO',
  subdomains: 'abcd',
  maxNativeZoom: 20,
}

export const BASEMAPS: Readonly<Record<BasemapId, BasemapConfig>> = {
  // Esri World Light Gray Canvas: quiet, light, and served without a key.
  light: {
    id: 'light',
    label: 'Light',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
    credit:
      'Esri World Light Gray Canvas: Esri, HERE, Garmin, © OpenStreetMap contributors and the GIS user community',
    maxNativeZoom: 16,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
    credit: 'Esri World Imagery: Esri, Maxar, Earthstar Geographics and the GIS user community',
    maxNativeZoom: 19,
  },
  // The OpenStreetMap standard style, for the analysis report's map. Not in BASEMAP_ORDER: the
  // monitoring map keeps its two quiet choices.
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    credit: 'OpenStreetMap standard tiles: © OpenStreetMap contributors (ODbL)',
    maxNativeZoom: 19,
  },
}

export const DEFAULT_BASEMAP: BasemapId = 'light'
export const BASEMAP_ORDER: readonly BasemapId[] = ['light', 'satellite']

/** Zoom limits. Close zoom shows single 10 m pixels; tiles are upscaled past their native zoom. */
export const MAP_MIN_ZOOM = 3
export const MAP_MAX_ZOOM = 22

/**
 * Colours the map draws from JavaScript (Leaflet path styles cannot read CSS variables).
 * They mirror src/styles/tokens.css; a test keeps them equal.
 */
export const MAP_COLORS = {
  /** Tar Black: selections, the footprint and hotspot selection rings, over a white halo. */
  mark: '#15171A',
  /** Slate Grey: quiet lines such as the image footprint. */
  muted: '#5A5A55',
  halo: '#FFFFFF',
  fallback: '#DCD8CE',
} as const
