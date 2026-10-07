import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectionsCsv } from '@/lib/export/csv'
import {
  DEFAULT_DISPLAY_PREFERENCES,
  formatArea,
  formatCoordinates,
  setDisplayPreferences,
} from '@/lib/format'
import { LEGACY_PREFERENCES_KEY, SETTINGS_STORAGE_KEY, serializeSettings } from '@/lib/settings'
import { createSettingsStore, type SettingsStorage } from './settingsStore'

const env = { useMock: true, apiBaseUrl: 'http://localhost:8000' }

function memoryStorage(initial: Record<string, string> = {}): SettingsStorage & {
  data: Map<string, string>
} {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const throwing: SettingsStorage = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError')
  },
  removeItem: () => {
    throw new DOMException('denied', 'SecurityError')
  },
}

afterEach(() => setDisplayPreferences(DEFAULT_DISPLAY_PREFERENCES))

describe('settings store', () => {
  it('starts on safe defaults with empty storage', () => {
    const store = createSettingsStore({ storage: memoryStorage(), env })
    expect(store.get()).toMatchObject({
      areaUnit: 'auto',
      coordinateFormat: 'decimal',
      dataSource: 'mock',
    })
    expect(store.loadStatus()).toBe('default')
  })

  it('saves each change at once as a versioned record and notifies subscribers', () => {
    const storage = memoryStorage()
    const store = createSettingsStore({ storage, env })
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.update({ areaUnit: 'ha' })).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
    expect(JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: 2,
      settings: { areaUnit: 'ha' },
    })
    // A new store reads it back.
    expect(createSettingsStore({ storage, env }).get().areaUnit).toBe('ha')
  })

  it('migrates the old preferences key and removes it', () => {
    const storage = memoryStorage({ [LEGACY_PREFERENCES_KEY]: '{"areaUnit":"km2"}' })
    const store = createSettingsStore({ storage, env })
    expect(store.loadStatus()).toBe('migrated')
    expect(store.get().areaUnit).toBe('km2')
    expect(storage.data.has(LEGACY_PREFERENCES_KEY)).toBe(false)
    expect(storage.data.get(SETTINGS_STORAGE_KEY)).toContain('"version":2')
  })

  it('falls back to defaults on corrupt JSON, and saves cleanly afterwards', () => {
    const storage = memoryStorage({ [SETTINGS_STORAGE_KEY]: '{"version":2,"settings":' })
    const store = createSettingsStore({ storage, env })
    expect(store.loadStatus()).toBe('corrupt')
    expect(store.get().areaUnit).toBe('auto')
    store.update({ coordinateFormat: 'dms' })
    expect(createSettingsStore({ storage, env }).get().coordinateFormat).toBe('dms')
  })

  it('keeps working when storage throws: defaults, then changes for this visit only', () => {
    const store = createSettingsStore({ storage: throwing, env })
    expect(store.get().areaUnit).toBe('auto')
    expect(store.update({ areaUnit: 'm2' })).toBe(false)
    expect(store.get().areaUnit).toBe('m2')
    expect(store.persistent()).toBe(false)
  })

  it('works with no storage at all', () => {
    const store = createSettingsStore({ storage: null, env })
    expect(store.update({ areaUnit: 'ha' })).toBe(false)
    expect(store.get().areaUnit).toBe('ha')
  })

  it('reads a current record, repairing invalid fields', () => {
    const storage = memoryStorage({
      [SETTINGS_STORAGE_KEY]: serializeSettings({
        ...createSettingsStore({ storage: null, env }).get(),
        defaultMinConfidence: 0.7,
      }),
    })
    expect(createSettingsStore({ storage, env }).get().defaultMinConfidence).toBe(0.7)
  })
})

describe('unit preferences flow into the formatters', () => {
  it('changes the default unit of every area and coordinate', () => {
    const store = createSettingsStore({ storage: memoryStorage(), env })
    expect(formatArea(25_000)).toBe('2.50 ha')
    store.update({ areaUnit: 'm2' })
    expect(formatArea(25_000)).toBe('25,000 m²')
    store.update({ areaUnit: 'km2' })
    expect(formatArea(25_000)).toBe('0.03 km²')
    store.update({ coordinateFormat: 'dms' })
    expect(formatCoordinates({ lat: 13.2215, lng: 80.3621 })).toBe('13°13′17.4″ N, 80°21′43.6″ E')
  })

  it('lets explicit units win, so export files stay in fixed units', () => {
    const store = createSettingsStore({ storage: memoryStorage(), env })
    store.update({ areaUnit: 'km2', coordinateFormat: 'dms' })
    expect(formatArea(25_000, { unit: 'm2' })).toBe('25,000 m²')
    expect(formatCoordinates({ lat: 1, lng: 2 }, { format: 'decimal', digits: 1 })).toBe(
      '1.0° N, 2.0° E',
    )
    const csv = detectionsCsv(
      { id: 'o', region: 'R', source: 'drone', capturedAt: '2026-01-01T00:00:00Z' },
      [
        {
          id: 'd1',
          areaM2: 25_000,
          confidence: 0.9,
          densityLevel: 'high',
          centroid: { lat: 13.2215, lng: 80.3621 },
          sourcePixelCount: 1,
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    )
    expect(csv).toContain(',13.2215,80.3621,25000,2.5,')
  })
})
