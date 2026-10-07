export const MAP_LAYER_IDS = ['detections', 'density', 'hotspots', 'footprint'] as const
export type MapLayerId = (typeof MAP_LAYER_IDS)[number]
export type VisibleLayers = Readonly<Record<MapLayerId, boolean>>

export const MAP_LAYER_LABELS: Readonly<Record<MapLayerId, string>> = {
  detections: 'Detections',
  density: 'Density',
  hotspots: 'Hotspots',
  footprint: 'Footprint',
}

/** Density starts off so the first view shows the detections themselves. */
export const DEFAULT_VISIBLE_LAYERS: VisibleLayers = {
  detections: true,
  density: false,
  hotspots: true,
  footprint: true,
}

/** Small previews show detections and hotspots only. */
export const PREVIEW_VISIBLE_LAYERS: VisibleLayers = {
  detections: true,
  density: false,
  hotspots: true,
  footprint: false,
}

export type LayerVisibilityAction =
  | { type: 'toggle'; layer: MapLayerId }
  | { type: 'set'; layer: MapLayerId; visible: boolean }
  | { type: 'reset' }

export function layerVisibilityReducer(
  state: VisibleLayers,
  action: LayerVisibilityAction,
): VisibleLayers {
  switch (action.type) {
    case 'toggle':
      return { ...state, [action.layer]: !state[action.layer] }
    case 'set':
      return state[action.layer] === action.visible
        ? state
        : { ...state, [action.layer]: action.visible }
    case 'reset':
      return DEFAULT_VISIBLE_LAYERS
  }
}
