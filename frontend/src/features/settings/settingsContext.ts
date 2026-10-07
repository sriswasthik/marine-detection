import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import { formatArea, formatCoordinates, type AreaUnit, type CoordinateFormat } from '@/lib/format'
import type { AppSettings } from '@/lib/settings'
import type { LatLng } from '@/features/observations/types'
import { getAppSettingsStore, type SettingsStore } from './settingsStore'

/** The store in use. Null means the app-wide store (see SettingsProvider). */
export const SettingsContext = createContext<SettingsStore | null>(null)

export function useSettingsStore(): SettingsStore {
  return useContext(SettingsContext) ?? getAppSettingsStore()
}

/** Current settings. Re-renders when any setting changes. */
export function useSettings(): AppSettings {
  const store = useSettingsStore()
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/** Saves a change at once. Returns false when storage refused it (it still applies this visit). */
export function useUpdateSettings(): (patch: Partial<AppSettings>) => boolean {
  const store = useSettingsStore()
  return useCallback((patch) => store.update(patch), [store])
}

export interface Formatters {
  areaUnit: AreaUnit
  coordinateFormat: CoordinateFormat
  area: (areaM2: number | null | undefined) => string
  coordinates: (point: LatLng | null | undefined, options?: { digits?: number }) => string
}

/**
 * Area and coordinate formatters bound to the person's units. Components that show areas or
 * coordinates use this, so they re-render the moment a unit changes in Settings.
 */
export function useFormat(): Formatters {
  const { areaUnit, coordinateFormat } = useSettings()
  return useMemo(
    () => ({
      areaUnit,
      coordinateFormat,
      area: (areaM2) => formatArea(areaM2, { unit: areaUnit }),
      coordinates: (point, options = {}) =>
        formatCoordinates(point, { ...options, format: coordinateFormat }),
    }),
    [areaUnit, coordinateFormat],
  )
}
