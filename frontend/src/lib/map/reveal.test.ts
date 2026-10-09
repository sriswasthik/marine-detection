import { describe, expect, it } from 'vitest'
import { REVEAL_TOTAL_MS, revealFactor, revealStyle } from './reveal'

describe('detection reveal', () => {
  it('finishes within 600 ms for any number of detections', () => {
    expect(REVEAL_TOTAL_MS).toBeLessThan(600)
    for (const count of [1, 2, 61, 2500]) {
      for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 7))) {
        expect(revealFactor(i, count, REVEAL_TOTAL_MS)).toBe(1)
      }
    }
  })

  it('staggers: earlier detections lead, in coarse steps', () => {
    expect(revealFactor(0, 10, 0)).toBe(0)
    expect(revealFactor(0, 10, 125)).toBe(0.5)
    expect(revealFactor(9, 10, 125)).toBe(0)
    expect(revealFactor(0, 10, 200)).toBeGreaterThan(revealFactor(5, 10, 200))
    expect(revealFactor(3, 10, 400) * 10).toBe(Math.round(revealFactor(3, 10, 400) * 10))
  })

  it('scales opacity only, and leaves finished styles untouched', () => {
    const style = { color: '#000', opacity: 0.8, fillOpacity: 0.5, weight: 1.5 }
    expect(revealStyle(style, 1)).toBe(style)
    expect(revealStyle(style, 0.5)).toEqual({ ...style, opacity: 0.4, fillOpacity: 0.25 })
  })
})
