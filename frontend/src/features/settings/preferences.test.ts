import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  parsePreferences,
  PREFERENCES_STORAGE_KEY,
  setPreferences,
  subscribePreferences,
} from './preferences'

afterEach(() => window.localStorage.clear())

describe('preferences', () => {
  it('defaults to automatic area units', () => {
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES)
    expect(DEFAULT_PREFERENCES.areaUnit).toBe('auto')
  })

  it('ignores unreadable or unknown stored values', () => {
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('null')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('{"areaUnit":"acres"}')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('{"areaUnit":"ha"}')).toEqual({ areaUnit: 'ha' })
  })

  it('stores a change, notifies subscribers and keeps the same object until the next change', () => {
    let calls = 0
    const unsubscribe = subscribePreferences(() => {
      calls += 1
    })
    setPreferences({ areaUnit: 'km2' })
    expect(calls).toBe(1)
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBe('{"areaUnit":"km2"}')
    expect(getPreferences()).toBe(getPreferences())
    expect(getPreferences().areaUnit).toBe('km2')
    unsubscribe()
  })
})
