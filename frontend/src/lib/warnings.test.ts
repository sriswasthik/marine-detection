import { describe, expect, it } from 'vitest'
import { describeWarnings } from './warnings'

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
