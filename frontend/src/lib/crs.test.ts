import { describe, expect, it } from 'vitest'
import {
  bboxToGeoBounds,
  isSupportedEpsg,
  latLngToUtm,
  resolutionMeters,
  utmToLatLng,
  utmZoneForEpsg,
} from './crs'

describe('UTM conversion', () => {
  it('matches a published reference point (CN Tower, 17T 630084 E 4833438 N)', () => {
    const utm = latLngToUtm({ lat: 43.6426, lng: -79.3871 })
    expect(utm.zone).toBe(17)
    expect(utm.hemisphere).toBe('north')
    expect(utm.easting).toBeCloseTo(630_084, -1)
    expect(utm.northing).toBeCloseTo(4_833_438, -1)
  })

  it('puts the central meridian at 500 km easting and the equator at 0 northing', () => {
    const utm = latLngToUtm({ lat: 0, lng: 81 })
    expect(utm.zone).toBe(44)
    expect(utm.easting).toBeCloseTo(500_000, 3)
    expect(utm.northing).toBeCloseTo(0, 3)
  })

  it('round trips in both hemispheres to a fraction of a meter', () => {
    for (const point of [
      { lat: 13.22, lng: 80.368 },
      { lat: 21.62, lng: 88.85 },
      { lat: -33.8688, lng: 151.2093 },
      { lat: 64.1466, lng: -21.9426 },
    ]) {
      const back = utmToLatLng(latLngToUtm(point))
      expect(back.lat).toBeCloseTo(point.lat, 7)
      expect(back.lng).toBeCloseTo(point.lng, 7)
    }
  })

  it('reads zones from EPSG codes', () => {
    expect(utmZoneForEpsg(32644)).toEqual({ zone: 44, hemisphere: 'north' })
    expect(utmZoneForEpsg(32756)).toEqual({ zone: 56, hemisphere: 'south' })
    expect(utmZoneForEpsg(3857)).toBeNull()
    expect(isSupportedEpsg(4326)).toBe(true)
    expect(isSupportedEpsg(32643)).toBe(true)
    expect(isSupportedEpsg(27700)).toBe(false)
    expect(isSupportedEpsg(null)).toBe(false)
  })
})

describe('bboxToGeoBounds', () => {
  it('passes geographic boxes through', () => {
    expect(bboxToGeoBounds([80.3, 13.1, 80.4, 13.3], 4326)).toEqual({
      west: 80.3,
      south: 13.1,
      east: 80.4,
      north: 13.3,
    })
  })

  it('converts a UTM box to bounds that contain its corners', () => {
    const sw = latLngToUtm({ lat: 13.2, lng: 80.34 }, { zone: 44, hemisphere: 'north' })
    const ne = latLngToUtm({ lat: 13.24, lng: 80.39 }, { zone: 44, hemisphere: 'north' })
    const bounds = bboxToGeoBounds([sw.easting, sw.northing, ne.easting, ne.northing], 32644)
    expect(bounds).not.toBeNull()
    expect(bounds?.south).toBeCloseTo(13.2, 3)
    expect(bounds?.north).toBeCloseTo(13.24, 3)
    expect(bounds?.west).toBeLessThan(80.341)
    expect(bounds?.east).toBeGreaterThan(80.389)
  })

  it('returns null for unknown systems or broken boxes', () => {
    expect(bboxToGeoBounds([0, 0, 1, 1], 3857)).toBeNull()
    expect(bboxToGeoBounds([0, 0, 1, 1], null)).toBeNull()
    expect(bboxToGeoBounds([0, 0, 1], 4326)).toBeNull()
    expect(bboxToGeoBounds([0, Number.NaN, 1, 1], 4326)).toBeNull()
  })
})

describe('resolutionMeters', () => {
  it('reads meters directly for UTM and converts degrees for geographic images', () => {
    expect(resolutionMeters([10, -10], 32644, 13)).toBe(10)
    expect(resolutionMeters([0.0001, -0.0001], 4326, 0)).toBeCloseTo(11.1, 1)
    expect(resolutionMeters([10, -10], 3857, 13)).toBeNull()
    expect(resolutionMeters([], 32644, 13)).toBeNull()
  })
})
