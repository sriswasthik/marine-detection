/**
 * Display preferences, kept in this browser only. The Settings page edits them; any screen can
 * read them with usePreferences. Reading never throws: storage that is blocked, empty or holds
 * something unreadable falls back to the defaults.
 */
import type { AreaUnit } from '@/lib/format'

export const AREA_UNITS: readonly AreaUnit[] = ['auto', 'm2', 'ha', 'km2']

export const AREA_UNIT_LABELS: Readonly<Record<AreaUnit, string>> = {
  auto: 'Auto',
  m2: 'm²',
  ha: 'ha',
  km2: 'km²',
}

export interface Preferences {
  /** Unit for areas in metrics. Auto picks m², ha or km² to fit each figure. */
  areaUnit: AreaUnit
}

export const DEFAULT_PREFERENCES: Preferences = { areaUnit: 'auto' }

export const PREFERENCES_STORAGE_KEY = 'mwi.preferences'

export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFERENCES
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return DEFAULT_PREFERENCES
    const areaUnit = (value as Record<string, unknown>).areaUnit
    return {
      areaUnit: (AREA_UNITS as readonly unknown[]).includes(areaUnit)
        ? (areaUnit as AreaUnit)
        : DEFAULT_PREFERENCES.areaUnit,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

const listeners = new Set<() => void>()
let cached: { raw: string | null; value: Preferences } | null = null

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Current preferences. Returns the same object until storage changes, as useSyncExternalStore needs. */
export function getPreferences(): Preferences {
  const raw = readRaw()
  if (!cached || cached.raw !== raw) cached = { raw, value: parsePreferences(raw) }
  return cached.value
}

let memoryOnly: Preferences | null = null

export function setPreferences(patch: Partial<Preferences>): void {
  const next = { ...(memoryOnly ?? getPreferences()), ...patch }
  const raw = JSON.stringify(next)
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, raw)
    memoryOnly = null
    cached = { raw, value: next }
  } catch {
    // Storage blocked: keep the choice for this visit only.
    memoryOnly = next
    cached = { raw: readRaw(), value: next }
  }
  listeners.forEach((listener) => listener())
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREFERENCES_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
