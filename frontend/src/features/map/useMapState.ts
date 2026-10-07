import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_FILTERS, type MapFilters } from '@/lib/filters'
import type { BasemapId } from '@/lib/map/basemaps'
import type { MapLayerId } from '@/lib/map/layers'
import { parseMapSearch, serializeMapSearch, type MapUrlState } from '@/lib/mapUrlState'

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
  const state = useMemo(() => parseMapSearch(params), [params])

  const update = useCallback(
    (change: (current: MapUrlState) => MapUrlState, options: UpdateOptions = {}) => {
      setParams((current) => serializeMapSearch(change(parseMapSearch(current))), {
        replace: options.replace ?? false,
        preventScrollReset: true,
      })
    },
    [setParams],
  )

  const setFilters = useCallback(
    (patch: Partial<MapFilters>, options?: UpdateOptions) =>
      // Hotspot ids are ranks, so a filter change makes the old id point elsewhere: clear it.
      update((s) => ({ ...s, filters: { ...s.filters, ...patch }, hotspotId: null }), options),
    [update],
  )

  const resetFilters = useCallback(
    () => update((s) => ({ ...s, filters: DEFAULT_FILTERS, hotspotId: null })),
    [update],
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
    setFilters,
    resetFilters,
    selectDetection,
    selectHotspot,
    setBasemap,
    toggleLayer,
    clearFresh,
  }
}
