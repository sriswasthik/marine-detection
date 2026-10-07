import { useReducer } from 'react'
import {
  DEFAULT_VISIBLE_LAYERS,
  layerVisibilityReducer,
  type MapLayerId,
  type VisibleLayers,
} from '@/lib/map/layers'

/** Layer visibility state for one map, with a toggle helper for the layer panel. */
export function useMapLayers(initial: VisibleLayers = DEFAULT_VISIBLE_LAYERS) {
  const [visibleLayers, dispatch] = useReducer(layerVisibilityReducer, initial)
  const toggleLayer = (layer: MapLayerId) => dispatch({ type: 'toggle', layer })
  return { visibleLayers, toggleLayer, dispatch }
}
