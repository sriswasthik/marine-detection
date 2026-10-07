import { describe, expect, it } from 'vitest'
import {
  defaultSettings,
  readSettings,
  sanitizeSettings,
  serializeSettings,
  SETTINGS_VERSION,
  validateApiBaseUrl,
} from './settings'

const defaults = defaultSettings({ useMock: true, apiBaseUrl: 'http://localhost:8000' })

describe('defaultSettings', () => {
  it('starts from automatic units, the light basemap and the environment data source', () => {
    expect(defaults).toMatchObject({
      areaUnit: 'auto',
      coordinateFormat: 'decimal',
      defaultBasemap: 'light',
      defaultMinConfidence: 0,
      dataSource: 'mock',
      apiBaseUrl: 'http://localhost:8000',
    })
    expect(defaultSettings({ useMock: false, apiBaseUrl: 'x' }).dataSource).toBe('live')
  })
})

describe('readSettings', () => {
  it('uses the defaults when nothing is stored', () => {
    expect(readSettings({ current: null, legacy: null }, defaults)).toEqual({
      settings: defaults,
      status: 'default',
    })
  })

  it('reads the current version back exactly', () => {
    const changed = { ...defaults, areaUnit: 'ha' as const, coordinateFormat: 'dms' as const }
    expect(readSettings({ current: serializeSettings(changed), legacy: null }, defaults)).toEqual({
      settings: changed,
      status: 'current',
    })
  })

  it('migrates version 1 from the old preferences key', () => {
    const result = readSettings({ current: null, legacy: '{"areaUnit":"km2"}' }, defaults)
    expect(result.status).toBe('migrated')
    expect(result.settings).toEqual({ ...defaults, areaUnit: 'km2' })
  })

  it('migrates a version 1 record stored under the new key', () => {
    const result = readSettings(
      { current: '{"version":1,"areaUnit":"m2"}', legacy: null },
      defaults,
    )
    expect(result).toEqual({ settings: { ...defaults, areaUnit: 'm2' }, status: 'migrated' })
  })

  it('falls back to the defaults for corrupt JSON or an unknown version', () => {
    for (const current of ['{not json', 'null', '[]', '"text"', '{"version":99,"settings":{}}']) {
      expect(readSettings({ current, legacy: null }, defaults)).toEqual({
        settings: defaults,
        status: 'corrupt',
      })
    }
    expect(readSettings({ current: null, legacy: '{oops' }, defaults).status).toBe('corrupt')
  })

  it('keeps valid fields and repairs invalid ones', () => {
    const stored = JSON.stringify({
      version: SETTINGS_VERSION,
      settings: {
        areaUnit: 'acres',
        coordinateFormat: 'dms',
        defaultBasemap: 'terrain',
        defaultMinConfidence: 7,
        defaultLayers: { detections: false, density: 'yes' },
        dataSource: 'live',
        apiBaseUrl: 'ftp://example.test',
      },
    })
    expect(readSettings({ current: stored, legacy: null }, defaults).settings).toEqual({
      ...defaults,
      coordinateFormat: 'dms',
      defaultMinConfidence: 1,
      defaultLayers: { ...defaults.defaultLayers, detections: false },
      dataSource: 'live',
    })
  })
})

describe('sanitizeSettings', () => {
  it('rounds the minimum confidence to whole percent and clamps it', () => {
    expect(sanitizeSettings({ defaultMinConfidence: 0.456 }, defaults).defaultMinConfidence).toBe(
      0.46,
    )
    expect(sanitizeSettings({ defaultMinConfidence: -1 }, defaults).defaultMinConfidence).toBe(0)
  })
})

describe('validateApiBaseUrl', () => {
  it('accepts http and https addresses and drops the trailing slash', () => {
    expect(validateApiBaseUrl(' https://api.example.org/v1/ ')).toEqual({
      ok: true,
      url: 'https://api.example.org/v1',
    })
    expect(validateApiBaseUrl('http://localhost:8000')).toEqual({
      ok: true,
      url: 'http://localhost:8000',
    })
  })

  it('explains what to fix', () => {
    expect(validateApiBaseUrl('')).toMatchObject({ ok: false, message: /Enter the address/ })
    expect(validateApiBaseUrl('localhost:8000')).toMatchObject({ ok: false })
    expect(validateApiBaseUrl('api.example.org')).toMatchObject({ ok: false, message: /http:\/\// })
    expect(validateApiBaseUrl('ftp://files.example.org')).toMatchObject({ ok: false })
    expect(validateApiBaseUrl('https://a.example?x=1')).toMatchObject({ ok: false })
  })
})
