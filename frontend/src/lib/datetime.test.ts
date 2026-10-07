import { describe, expect, it } from 'vitest'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from './datetime'

describe('datetime-local helpers', () => {
  it('formats a date in local time without seconds', () => {
    expect(toDateTimeLocalValue(new Date(2026, 9, 3, 9, 5, 41))).toBe('2026-10-03T09:05')
  })

  it('round trips through ISO', () => {
    const local = '2026-10-03T10:36'
    const iso = fromDateTimeLocalValue(local)
    expect(iso).toMatch(/^2026-10-0[23]T\d{2}:\d{2}:00Z$/)
    expect(toDateTimeLocalValue(new Date(iso ?? ''))).toBe(local)
  })

  it('rejects unreadable values', () => {
    expect(fromDateTimeLocalValue('')).toBeNull()
    expect(fromDateTimeLocalValue('yesterday')).toBeNull()
    expect(fromDateTimeLocalValue('2026-13-40T10:00')).toBeNull()
  })
})
