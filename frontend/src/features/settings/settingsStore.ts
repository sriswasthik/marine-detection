import { ENV } from '@/lib/env'
import { setDisplayPreferences } from '@/lib/format'
import {
  defaultSettings,
  LEGACY_PREFERENCES_KEY,
  readSettings,
  sanitizeSettings,
  serializeSettings,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
  type ReadResult,
} from '@/lib/settings'

/** The slice of Web Storage the store uses, so tests can pass a fake or a throwing one. */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface SettingsStore {
  get: () => AppSettings
  /** Merges a change, saves it, and notifies subscribers. Returns false when it could not be saved. */
  update: (patch: Partial<AppSettings>) => boolean
  reset: () => void
  subscribe: (listener: () => void) => () => void
  /** False when storage is unavailable: changes still apply, for this visit only. */
  persistent: () => boolean
  /** How the settings were loaded: defaults, current, migrated or corrupt. */
  loadStatus: () => ReadResult['status']
}

function browserStorage(): SettingsStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Accessing localStorage itself throws when storage is blocked.
    return null
  }
}

/**
 * Settings held in memory and saved to storage. Every storage call is guarded: when storage is
 * blocked, full or corrupt, the app runs on safe defaults (or the latest in-memory values).
 */
export function createSettingsStore(
  options: {
    storage?: SettingsStorage | null
    env?: { useMock: boolean; apiBaseUrl: string }
  } = {},
): SettingsStore {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const defaults = defaultSettings(options.env ?? ENV)
  const listeners = new Set<() => void>()
  let persistent = storage !== null

  const read = (key: string): string | null => {
    if (!storage) return null
    try {
      return storage.getItem(key)
    } catch {
      persistent = false
      return null
    }
  }

  const write = (settings: AppSettings): boolean => {
    if (!storage) return false
    try {
      storage.setItem(SETTINGS_STORAGE_KEY, serializeSettings(settings))
      persistent = true
      return true
    } catch {
      persistent = false
      return false
    }
  }

  const loaded = readSettings(
    { current: read(SETTINGS_STORAGE_KEY), legacy: read(LEGACY_PREFERENCES_KEY) },
    defaults,
  )
  let settings = loaded.settings
  if (loaded.status === 'migrated' && write(settings)) {
    try {
      storage?.removeItem(LEGACY_PREFERENCES_KEY)
    } catch {
      // The old key stays; it is ignored once the new one exists.
    }
  }
  setDisplayPreferences(settings)

  const publish = () => {
    setDisplayPreferences(settings)
    listeners.forEach((listener) => listener())
  }

  return {
    get: () => settings,
    update: (patch) => {
      settings = sanitizeSettings({ ...settings, ...patch }, defaults)
      const saved = write(settings)
      publish()
      return saved
    },
    reset: () => {
      settings = defaults
      write(settings)
      publish()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    persistent: () => persistent,
    loadStatus: () => loaded.status,
  }
}

let appStore: SettingsStore | null = null

/** The app-wide store, created on first use. */
export function getAppSettingsStore(): SettingsStore {
  appStore ??= createSettingsStore()
  return appStore
}
