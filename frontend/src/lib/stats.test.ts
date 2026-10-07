import { describe, expect, it } from 'vitest'
import { makeDetection, makeScene } from '@/test/geoFixtures'
import { analyzeObservation } from './analysis'
import { confidenceBand, computeObservationStats } from './stats'

function containsNaN(value: unknown): boolean {
  if (typeof value === 'number') return Number.isNaN(value)
  if (Array.isArray(value)) return value.some(containsNaN)
  if (value && typeof value === 'object') return Object.values(value).some(containsNaN)
  return false
}

const scene = makeScene(1000, 500)

describe('computeObservationStats', () => {
  it('returns zeros and nulls, never NaN, for zero detections', () => {
    const stats = computeObservationStats([], [])
    expect(containsNaN(stats)).toBe(false)
    expect(stats.hasDebris).toBe(false)
    expect(stats.detectionCount).toBe(0)
    expect(stats.hotspotCount).toBe(0)
    expect(stats.totalDebrisAreaM2).toBe(0)
    expect(stats.meanDetectionAreaM2).toBeNull()
    expect(stats.largestDetectionAreaM2).toBeNull()
    expect(stats.confidence.mean).toBeNull()
    expect(stats.confidence.median).toBeNull()
    expect(stats.byLevel.map((l) => l.areaShare)).toEqual([0, 0, 0, 0])
    expect(stats.confidence.bands.low).toEqual({ count: 0, share: 0 })
  })

  it('breaks area down by density level with shares summing to one', () => {
    const detections = [
      makeDetection('a', scene.polygon(scene.rect(0, 0, 100, 100)), {
        densityLevel: 'high',
        confidence: 0.9,
      }),
      makeDetection('b', scene.polygon(scene.rect(200, 0, 300, 50)), {
        densityLevel: 'low',
        confidence: 0.4,
      }),
      makeDetection('c', scene.polygon(scene.rect(400, 0, 450, 50)), {
        densityLevel: 'high',
        confidence: 0.6,
      }),
    ]
    const stats = computeObservationStats(detections)
    expect(stats.detectionCount).toBe(3)
    const high = stats.byLevel.find((l) => l.level === 'high')
    expect(high?.detectionCount).toBe(2)
    expect(stats.byLevel.reduce((s, l) => s + l.areaShare, 0)).toBeCloseTo(1, 10)
    expect(stats.byLevel.map((l) => l.level)).toEqual(['low', 'moderate', 'high', 'critical'])
    expect(stats.confidence.mean).toBeCloseTo((0.9 + 0.4 + 0.6) / 3, 10)
    expect(stats.confidence.median).toBe(0.6)
    expect(stats.confidence.min).toBe(0.4)
    expect(stats.confidence.max).toBe(0.9)
    expect(stats.confidence.bands.high.count).toBe(1)
    expect(stats.confidence.bands.medium.count).toBe(1)
    expect(stats.confidence.bands.low.count).toBe(1)
    expect(stats.largestDetectionAreaM2).toBeCloseTo(10_000, 0)
  })

  it('takes the median of an even count', () => {
    const detections = [0.5, 0.7, 0.9, 0.6].map((confidence, i) =>
      makeDetection(`d${i}`, scene.polygon(scene.rect(i * 100, 0, i * 100 + 10, 10)), {
        confidence,
      }),
    )
    expect(computeObservationStats(detections).confidence.median).toBeCloseTo(0.65, 10)
  })

  it('bands confidence at the configured thresholds', () => {
    expect(confidenceBand(0.59)).toBe('low')
    expect(confidenceBand(0.6)).toBe('medium')
    expect(confidenceBand(0.79)).toBe('medium')
    expect(confidenceBand(0.8)).toBe('high')
  })
})

describe('analyzeObservation', () => {
  it('handles an observation with no detections', () => {
    const analysis = analyzeObservation({ detections: [], bounds: scene.bounds, resolutionM: 10 })
    expect(analysis.hotspots).toEqual([])
    expect(analysis.grid?.cells.every((c) => c.level === null)).toBe(true)
    expect(containsNaN(analysis.stats)).toBe(false)
  })

  it('falls back to the detections extent without bounds, and to no grid without either', () => {
    const detection = makeDetection('a', scene.polygon(scene.rect(0, 0, 100, 100)))
    const withoutBounds = analyzeObservation({ detections: [detection], bounds: null })
    expect(withoutBounds.grid).not.toBeNull()
    expect(withoutBounds.stats.detectionCount).toBe(1)
    const nothing = analyzeObservation({ detections: [], bounds: null })
    expect(nothing.grid).toBeNull()
    expect(nothing.hotspots).toEqual([])
  })
})
