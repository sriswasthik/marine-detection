import { describe, expect, it } from 'vitest'
import type { ObservationWarning } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS } from './config'
import {
  describeWarnings,
  hasApproximatePositions,
  isLowConfidenceResult,
  observationNotices,
} from './warnings'

describe('describeWarnings', () => {
  it('returns nothing without warnings', () => {
    expect(describeWarnings({})).toEqual([])
    expect(describeWarnings({ warnings: [] })).toEqual([])
  })

  it('explains each warning in order, without duplicates', () => {
    const messages = describeWarnings({
      warnings: ['LOW_CONFIDENCE', 'HIGH_CLOUD', 'LOW_CONFIDENCE'],
      cloudCoveragePercent: 41,
    })
    expect(messages.map((m) => m.code)).toEqual(['LOW_CONFIDENCE', 'HIGH_CLOUD'])
    expect(messages[1]?.detail).toContain('41.0%')
  })

  it('words cloud cover without a figure when none is known', () => {
    const [message] = describeWarnings({ warnings: ['HIGH_CLOUD'] })
    expect(message?.detail).toBe('Clouds covered part of the image, so some debris may be hidden.')
  })

  it('covers georeferencing and resolution', () => {
    const titles = describeWarnings({ warnings: ['PARTIAL_GEOREF', 'LOW_RESOLUTION'] }).map(
      (m) => m.title,
    )
    expect(titles).toEqual(['Approximate positions', 'Coarse resolution'])
  })
})

describe('low-confidence rule', () => {
  const base = { averageConfidence: 0.75, warnings: [] as ObservationWarning[] }

  it('triggers below the threshold, at it does not', () => {
    expect(
      isLowConfidenceResult({ ...base, averageConfidence: CONFIDENCE_THRESHOLDS.low - 0.01 }),
    ).toBe(true)
    expect(isLowConfidenceResult({ ...base, averageConfidence: CONFIDENCE_THRESHOLDS.low })).toBe(
      false,
    )
  })

  it('triggers on the LOW_CONFIDENCE flag even with a good average', () => {
    expect(isLowConfidenceResult({ ...base, warnings: ['LOW_CONFIDENCE'] })).toBe(true)
  })

  it('does not trigger without detections to doubt', () => {
    expect(isLowConfidenceResult({ ...base, averageConfidence: null })).toBe(false)
  })
})

describe('observationNotices', () => {
  const observation = {
    averageConfidence: 0.75,
    warnings: [] as ObservationWarning[],
    crs: 'EPSG:32644',
    bounds: { north: 1, south: 0, east: 1, west: 0 },
    detections: [{}],
  }

  it('is empty for a confident, placed result', () => {
    expect(observationNotices(observation)).toEqual([])
  })

  it('states the average and the threshold when confidence is low', () => {
    const [notice] = observationNotices({ ...observation, averageConfidence: 0.54 })
    expect(notice).toMatchObject({ id: 'low-confidence', title: 'Low confidence' })
    expect(notice?.message).toMatch(/Average confidence is 54%, below the 60% threshold/)
    expect(notice?.message).toMatch(/dashed, lighter/)
  })

  it('says nothing about confidence when there is nothing detected', () => {
    expect(
      observationNotices({
        ...observation,
        averageConfidence: null,
        detections: [],
        warnings: ['LOW_CONFIDENCE'],
      }),
    ).toEqual([])
  })

  it('treats a missing CRS, missing bounds or PARTIAL_GEOREF as approximate positions', () => {
    const ids = (o: Parameters<typeof observationNotices>[0]) =>
      observationNotices(o).map((n) => n.id)
    expect(ids({ ...observation, crs: null })).toEqual(['approximate-positions'])
    expect(ids({ ...observation, bounds: null })).toEqual(['approximate-positions'])
    expect(ids({ ...observation, warnings: ['PARTIAL_GEOREF'] })).toEqual(['approximate-positions'])
    expect(hasApproximatePositions(observation)).toBe(false)
  })

  it('orders notices by importance and can be narrowed', () => {
    const all = observationNotices(
      {
        ...observation,
        averageConfidence: 0.4,
        crs: null,
        warnings: ['HIGH_CLOUD', 'LOW_RESOLUTION'],
        cloudCoveragePercent: 41,
      },
      { partialData: true },
    )
    expect(all.map((n) => n.id)).toEqual([
      'low-confidence',
      'approximate-positions',
      'partial-data',
      'cloud-cover',
      'coarse-resolution',
    ])
    expect(
      observationNotices(
        { ...observation, averageConfidence: 0.4, warnings: ['HIGH_CLOUD'] },
        {
          only: ['low-confidence'],
        },
      ).map((n) => n.id),
    ).toEqual(['low-confidence'])
  })
})

describe('stripe artefacts', () => {
  const stripe = {
    reason: 'stripe' as const,
    pixels: 698,
    areaM2: 69_800,
    confidence: 0.42,
    rowSpan: 6,
    colSpan: 246,
    firstRow: 2,
    firstCol: 5,
  }

  it('says what was left out, how big it was and why', () => {
    const [message] = describeWarnings({
      warnings: ['STRIPE_ARTEFACT'],
      suppressedRegions: [stripe],
    })
    expect(message?.title).toBe('Image stripe left out')
    expect(message?.detail).toMatch(/^A straight band along the image rows or columns/)
    expect(message?.detail).toContain('698 pixels')
    expect(message?.detail).toMatch(/known to draw such bands near image edges/)
  })

  it('counts several bands', () => {
    const [message] = describeWarnings({
      warnings: ['STRIPE_ARTEFACT'],
      suppressedRegions: [stripe, { ...stripe, pixels: 2, areaM2: 200 }],
    })
    expect(message?.detail).toMatch(/^2 straight bands/)
    expect(message?.detail).toContain('700 pixels')
  })

  it('becomes a notice on every result surface', () => {
    const notices = observationNotices({
      averageConfidence: 0.9,
      warnings: ['STRIPE_ARTEFACT'],
      crs: 'EPSG:32618',
      bounds: { north: 1, south: 0, east: 1, west: 0 },
      suppressedRegions: [stripe],
      detections: [{}],
    })
    expect(notices.map((n) => n.id)).toEqual(['stripe-artefact'])
  })
})
