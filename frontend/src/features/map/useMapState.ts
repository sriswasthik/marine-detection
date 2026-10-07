import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '@/features/settings/settingsContext'
import type { MapFilters } from '@/lib/filters'
import type { BasemapId } from '@/lib/map/basemaps'
import type { MapLayerId } from '@/lib/map/layers'
import {
  baselineFilters,
  parseMapSearch,
  serializeMapSearch,
  type MapDefaults,
  type MapUrlState,
} from '@/lib/mapUrlState'

interface UpdateOptions {
  /** Replace the history entry instead of adding one (sliders, transient params). */
  replace?: boolean
}

/**
 * Map page state kept in the URL search params: filters, selection, basemap and layers.
 * Selections add history entries so Back closes the drawer; slider moves replace them.
 */
export function useMapState() {
  const [params, setParams] = useSearchParams()
  const settings = useSettings()
  const defaults = useMemo<MapDefaults>(
    () => ({
      basemap: settings.defaultBasemap,
      minConfidence: settings.defaultMinConfidence,
      layers: settings.defaultLayers,
    }),
    [settings.defaultBasemap, settings.defaultMinConfidence, settings.defaultLayers],
  )
  const baseline = useMemo(() => baselineFilters(defaults), [defaults])
  const state = useMemo(() => parseMapSearch(params, defaults), [params, defaults])

  const update = useCallback(
    (change: (current: MapUrlState) => MapUrlState, options: UpdateOptions = {}) => {
      setParams(
        (current) => serializeMapSearch(change(parseMapSearch(current, defaults)), defaults),
        {
          replace: options.replace ?? false,
          preventScrollReset: true,
        },
      )
    },
    [setParams, defaults],
  )

  const setFilters = useCallback(
    (patch: Partial<MapFilters>, options?: UpdateOptions) =>
      // Hotspot ids are ranks, so a filter change makes the old id point elsewhere: clear it.
      update((s) => ({ ...s, filters: { ...s.filters, ...patch }, hotspotId: null }), options),
    [update],
  )

  const resetFilters = useCallback(
    () => update((s) => ({ ...s, filters: baseline, hotspotId: null })),
    [update, baseline],
  )

  const selectDetection = useCallback(
    (id: string | null) => update((s) => ({ ...s, detectionId: id, hotspotId: null })),
    [update],
  )

  const selectHotspot = useCallback(
    (id: string | null) => update((s) => ({ ...s, hotspotId: id, detectionId: null })),
    [update],
  )

  const setBasemap = useCallback(
    (basemap: BasemapId) => update((s) => ({ ...s, basemap }), { replace: true }),
    [update],
  )

  const toggleLayer = useCallback(
    (layer: MapLayerId) =>
      update((s) => ({ ...s, layers: { ...s.layers, [layer]: !s.layers[layer] } }), {
        replace: true,
      }),
    [update],
  )

  const clearFresh = useCallback(
    () => update((s) => ({ ...s, fresh: false }), { replace: true }),
    [update],
  )

  return {
    ...state,
    params,
    /** The Settings defaults this map falls back to. */
    defaults,
    /** The filters Reset returns to. */
    baseline,
    setFilters,
    resetFilters,
    selectDetection,
    selectHotspot,
    setBasemap,
    toggleLayer,
    clearFresh,
  }
}
