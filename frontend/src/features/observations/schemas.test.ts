import { describe, expect, it } from 'vitest'
import { getSampleObservation, HERO_SAMPLE_ID } from './mock/samples'
import { parseObservation, parseObservationList } from './schemas'
import type { Observation } from './types'

function hero(): Observation {
  const sample = getSampleObservation(HERO_SAMPLE_ID)
  if (!sample) throw new Error('Hero sample missing')
  return JSON.parse(JSON.stringify(sample)) as Observation
}

function summaryOf({ detections, ...rest }: Observation) {
  return { ...rest, detectionCount: detections.length }
}

describe('parseObservation', () => {
  it('accepts a complete observation', () => {
    const result = parseObservation(hero())
    expect(result.status).toBe('valid')
    expect(result.issues).toEqual([])
    expect(result.data?.detections.length).toBeGreaterThan(0)
  })

  it('drops malformed detections and reports a partial result', () => {
    const input = hero() as unknown as { detections: Record<string, unknown>[] }
    const total = input.detections.length
    const target = input.detections[3]
    if (!target) throw new Error('Expected at least four detections')
    target.confidence = 2
    const ringBroken = input.detections[5]
    if (!ringBroken) throw new Error('Expected at least six detections')
    ringBroken.geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [80, 13],
          [80.1, 13],
          [80.1, 13.1],
        ],
      ],
    }

    const result = parseObservation(input)
    expect(result.status).toBe('partial')
    expect(result.data?.detections).toHaveLength(total - 2)
    const paths = result.issues.map((i) => i.path)
    expect(paths).toContain('detections.3.confidence')
    expect(paths.some((p) => p.startsWith('detections.5.geometry'))).toBe(true)
  })

  it('rejects an observation whose own fields are wrong', () => {
    const input = { ...hero(), id: undefined, status: 'unknown' }
    const result = parseObservation(input)
    expect(result.status).toBe('invalid')
    expect(result.data).toBeNull()
    expect(result.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['id', 'status']))
  })

  it('accepts null bounds, crs and density for partial or empty results', () => {
    const input = {
      ...hero(),
      bounds: null,
      crs: null,
      densityLevel: null,
      averageConfidence: null,
      detections: [],
    }
    expect(parseObservation(input).status).toBe('valid')
  })

  it('rejects non-objects without throwing', () => {
    expect(parseObservation(null).status).toBe('invalid')
    expect(parseObservation('observation').status).toBe('invalid')
  })
})

describe('parseObservationList', () => {
  it('accepts a list of summaries', () => {
    const result = parseObservationList([summaryOf(hero())])
    expect(result.status).toBe('valid')
    expect(result.data).toHaveLength(1)
  })

  it('accepts an empty list', () => {
    expect(parseObservationList([])).toEqual({ status: 'valid', data: [], issues: [] })
  })

  it('keeps good items and reports bad ones', () => {
    const result = parseObservationList([summaryOf(hero()), { id: 'broken' }])
    expect(result.status).toBe('partial')
    expect(result.data).toHaveLength(1)
    expect(result.issues.every((i) => i.path.startsWith('1'))).toBe(true)
  })

  it('is invalid when nothing is usable or the input is not a list', () => {
    expect(parseObservationList([{ id: 'broken' }]).status).toBe('invalid')
    expect(parseObservationList({ items: [] }).status).toBe('invalid')
  })
})
