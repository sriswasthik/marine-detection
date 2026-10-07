export type BasemapId = 'light' | 'satellite'

export interface BasemapConfig {
  id: BasemapId
  label: string
  url: string
  attribution: string
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
    maxNativeZoom: 16,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
    maxNativeZoom: 19,
  },
}

export const DEFAULT_BASEMAP: BasemapId = 'light'
export const BASEMAP_ORDER: readonly BasemapId[] = ['light', 'satellite']

/** Zoom limits. Drone scenes need very close zoom; tiles are upscaled past their native zoom. */
export const MAP_MIN_ZOOM = 3
export const MAP_MAX_ZOOM = 22

/**
 * Colours the map draws from JavaScript (Leaflet path styles cannot read CSS variables).
 * They mirror src/styles/tokens.css; a test keeps them equal.
 */
export const MAP_COLORS = {
  accent: '#2F6F6D',
  halo: '#FFFFFF',
  fallback: '#EEF2F1',
} as const
