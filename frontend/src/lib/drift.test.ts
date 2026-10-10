import { describe, expect, it } from 'vitest'
import type { Detection, Hotspot } from '@/features/observations/types'
import { compassDirection, DRIFT_SPEED_RANGE_KMH, forecastDrift, movePoint } from './drift'
import { haversineDistanceM } from './geo'

function detection(id: string, lat: number, lng: number, areaM2: number): Detection {
  return {
    id,
    geometry: { type: 'Polygon', coordinates: [] },
    areaM2,
    confidence: 0.8,
    densityLevel: 'high',
    centroid: { lat, lng },
    sourcePixelCount: areaM2 / 100,
  }
}

function hotspot(lat: number, lng: number): Hotspot {
  return {
    id: 'hotspot-1',
    rank: 1,
    level: 'high',
    bounds: { north: lat + 0.01, south: lat - 0.01, east: lng + 0.01, west: lng - 0.01 },
    centroid: { lat, lng },
    cellIds: [],
    detectionIds: [],
    totalAreaM2: 1000,
    meanConfidence: 0.8,
    priorityScore: 2400,
  }
}

const bounds = { north: 16, south: 15.9, east: -86.1, west: -86.2 }

describe('forecastDrift', () => {
  it('starts at the top hotspot of the image', () => {
    const forecast = forecastDrift(
      { id: 'obs-1', bounds, detections: [detection('d1', 15.95, -86.15, 500)] },
      [hotspot(15.93, -86.12)],
    )
    expect(forecast?.observed).toEqual({ lat: 15.93, lng: -86.12 })
  })

  it('falls back to the area-weighted debris centre without hotspots', () => {
    const forecast = forecastDrift(
      {
        id: 'obs-1',
        bounds,
        detections: [detection('d1', 15.9, -86.2, 300), detection('d2', 16, -86.1, 100)],
      },
      [],
    )
    expect(forecast?.observed.lat).toBeCloseTo(15.925)
    expect(forecast?.observed.lng).toBeCloseTo(-86.175)
  })

  it('returns null when the image holds no debris', () => {
    expect(forecastDrift({ id: 'obs-1', bounds, detections: [] }, [])).toBeNull()
  })

  it('gives the same image the same forecast and different images different ones', () => {
    const input = { bounds, detections: [detection('d1', 15.95, -86.15, 500)] }
    const a = forecastDrift({ id: 'obs-a', ...input }, [])
    expect(forecastDrift({ id: 'obs-a', ...input }, [])).toEqual(a)
    const b = forecastDrift({ id: 'obs-b', ...input }, [])
    expect(b?.predicted).not.toEqual(a?.predicted)
  })

  it('moves along one bearing at the drawn speed, and the search zone covers the path', () => {
    const forecast = forecastDrift(
      { id: 'obs-1', bounds, detections: [detection('d1', 15.95, -86.15, 500)] },
      [],
    )
    if (!forecast) throw new Error('expected a forecast')
    const [min, max] = DRIFT_SPEED_RANGE_KMH
    expect(forecast.speedKmH).toBeGreaterThanOrEqual(min)
    expect(forecast.speedKmH).toBeLessThanOrEqual(max)
    expect(forecast.trajectory.map((p) => p.hours)).toEqual([6, 12, 24])
    expect(forecast.predicted).toEqual(forecast.trajectory[2]?.point)
    for (const { hours, point } of forecast.trajectory) {
      expect(haversineDistanceM(forecast.observed, point) / 1000).toBeCloseTo(
        forecast.speedKmH * hours,
        0,
      )
    }
    const radiusM = forecast.searchZone.radiusKm * 1000
    for (const point of [forecast.observed, forecast.predicted]) {
      expect(haversineDistanceM(forecast.searchZone.centre, point)).toBeLessThan(radiusM)
    }
  })
})

describe('movePoint', () => {
  it('moves north and east by the given distance', () => {
    const start = { lat: 0, lng: 0 }
    expect(movePoint(start, 0, 1000).lat).toBeGreaterThan(0)
    expect(movePoint(start, 90, 1000).lng).toBeGreaterThan(0)
    expect(haversineDistanceM(start, movePoint(start, 45, 5000))).toBeCloseTo(5000, -1)
  })
})

describe('compassDirection', () => {
  it('names the nearest of eight directions', () => {
    expect(compassDirection(0)).toBe('N')
    expect(compassDirection(47)).toBe('NE')
    expect(compassDirection(181)).toBe('S')
    expect(compassDirection(350)).toBe('N')
    expect(compassDirection(-90)).toBe('W')
  })
})
