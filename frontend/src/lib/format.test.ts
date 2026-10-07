import { describe, expect, it } from 'vitest'
import {
  EMPTY_VALUE,
  formatArea,
  formatConfidence,
  formatCoordinates,
  formatCoveragePercent,
  formatDate,
  formatDateTime,
  formatDuration,
  formatInteger,
  slugify,
} from './format'

describe('formatArea', () => {
  it('uses square meters under 10,000 m²', () => {
    expect(formatArea(0)).toBe('0 m²')
    expect(formatArea(0.004)).toBe('<0.01 m²')
    expect(formatArea(0.27)).toBe('0.27 m²')
    expect(formatArea(4.56)).toBe('4.6 m²')
    expect(formatArea(842.4)).toBe('842 m²')
    expect(formatArea(9_999)).toBe('9,999 m²')
  })

  it('switches to hectares, then square kilometers', () => {
    expect(formatArea(10_000)).toBe('1.00 ha')
    expect(formatArea(12_400)).toBe('1.24 ha')
    expect(formatArea(243_000)).toBe('24.3 ha')
    expect(formatArea(999_000)).toBe('99.9 ha')
    expect(formatArea(1_000_000)).toBe('1.00 km²')
    expect(formatArea(27_000_000)).toBe('27.0 km²')
    expect(formatArea(1_234_000_000)).toBe('1,234 km²')
  })

  it('respects a unit preference', () => {
    expect(formatArea(12_400, { unit: 'm2' })).toBe('12,400 m²')
    expect(formatArea(500, { unit: 'ha' })).toBe('0.05 ha')
    expect(formatArea(50, { unit: 'km2' })).toBe('<0.01 km²')
    expect(formatArea(2_500_000, { unit: 'ha' })).toBe('250 ha')
  })

  it('handles missing and invalid values', () => {
    expect(formatArea(null)).toBe(EMPTY_VALUE)
    expect(formatArea(undefined)).toBe(EMPTY_VALUE)
    expect(formatArea(Number.NaN)).toBe(EMPTY_VALUE)
    expect(formatArea(-1)).toBe(EMPTY_VALUE)
    expect(formatArea(Infinity)).toBe(EMPTY_VALUE)
  })
})

describe('formatCoveragePercent', () => {
  it('adapts precision to the size', () => {
    expect(formatCoveragePercent(12.4)).toBe('12.4%')
    expect(formatCoveragePercent(100)).toBe('100.0%')
    expect(formatCoveragePercent(0.84)).toBe('0.84%')
    expect(formatCoveragePercent(0.012)).toBe('0.012%')
    expect(formatCoveragePercent(0.0004)).toBe('<0.001%')
    expect(formatCoveragePercent(0)).toBe('0%')
  })

  it('handles missing and invalid values', () => {
    expect(formatCoveragePercent(null)).toBe(EMPTY_VALUE)
    expect(formatCoveragePercent(Number.NaN)).toBe(EMPTY_VALUE)
    expect(formatCoveragePercent(-3)).toBe(EMPTY_VALUE)
  })
})

describe('formatConfidence', () => {
  it('renders whole percents', () => {
    expect(formatConfidence(0.87)).toBe('87%')
    expect(formatConfidence(0.875)).toBe('88%')
    expect(formatConfidence(0)).toBe('0%')
    expect(formatConfidence(1)).toBe('100%')
  })

  it('clamps out-of-range values and handles missing ones', () => {
    expect(formatConfidence(1.4)).toBe('100%')
    expect(formatConfidence(-0.2)).toBe('0%')
    expect(formatConfidence(null)).toBe(EMPTY_VALUE)
  })
})

describe('formatCoordinates', () => {
  it('formats decimal degrees with hemispheres and five decimals', () => {
    expect(formatCoordinates({ lat: 13.2215, lng: 80.3621 })).toBe('13.22150° N, 80.36210° E')
    expect(formatCoordinates({ lat: -33.8688, lng: -151.2093 })).toBe('33.86880° S, 151.20930° W')
    expect(formatCoordinates({ lat: 0, lng: 0 })).toBe('0.00000° N, 0.00000° E')
  })

  it('formats degrees, minutes and seconds', () => {
    expect(formatCoordinates({ lat: 13.2215, lng: 80.3621 }, { format: 'dms' })).toBe(
      '13°13′17.4″ N, 80°21′43.6″ E',
    )
    expect(formatCoordinates({ lat: 9.99999999, lng: -0.5 }, { format: 'dms' })).toBe(
      '10°00′00.0″ N, 0°30′00.0″ W',
    )
  })

  it('handles missing points', () => {
    expect(formatCoordinates(null)).toBe(EMPTY_VALUE)
    expect(formatCoordinates({ lat: Number.NaN, lng: 1 })).toBe(EMPTY_VALUE)
  })
})

describe('dates and durations', () => {
  it('includes date, time and a time zone abbreviation', () => {
    const text = formatDateTime('2026-10-03T05:06:41Z', {
      locale: 'en-GB',
      timeZone: 'Asia/Kolkata',
    })
    expect(text).toContain('2026')
    expect(text).toContain('10:36')
    expect(text).toMatch(/GMT\+5:30|IST/)
    expect(formatDateTime('2026-10-03T05:06:41Z', { locale: 'en-US', timeZone: 'UTC' })).toMatch(
      /UTC/,
    )
  })

  it('formats a date without time', () => {
    expect(formatDate('2026-10-03T05:06:41Z', { locale: 'en-GB', timeZone: 'UTC' })).toBe(
      '3 Oct 2026',
    )
  })

  it('handles invalid dates', () => {
    expect(formatDateTime('not a date')).toBe(EMPTY_VALUE)
    expect(formatDateTime(null)).toBe(EMPTY_VALUE)
    expect(formatDate(undefined)).toBe(EMPTY_VALUE)
  })

  it('formats durations at every scale', () => {
    expect(formatDuration(0)).toBe('0 ms')
    expect(formatDuration(450)).toBe('450 ms')
    expect(formatDuration(8_200)).toBe('8.2 s')
    expect(formatDuration(47_000)).toBe('47 s')
    expect(formatDuration(125_000)).toBe('2 min 05 s')
    expect(formatDuration(3_840_000)).toBe('1 h 04 min')
    expect(formatDuration(null)).toBe(EMPTY_VALUE)
    expect(formatDuration(-5)).toBe(EMPTY_VALUE)
  })
})

describe('formatInteger and slugify', () => {
  it('groups thousands', () => {
    expect(formatInteger(1234567)).toBe('1,234,567')
    expect(formatInteger(0)).toBe('0')
    expect(formatInteger(null)).toBe(EMPTY_VALUE)
  })

  it('makes URL-safe slugs', () => {
    expect(slugify('Ennore coast, Bay of Bengal')).toBe('ennore-coast-bay-of-bengal')
    expect(slugify('  Café   Déjà vu! ')).toBe('cafe-deja-vu')
    expect(slugify('---')).toBe('')
  })
})
