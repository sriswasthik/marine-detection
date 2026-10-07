import { describe, expect, it } from 'vitest'
import { contrastRatio, parseHex, relativeLuminance } from './contrast'

describe('contrast helpers', () => {
  it('parses short and long hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(parseHex('2F6F6D')).toEqual([47, 111, 109])
    expect(() => parseHex('#12')).toThrow(TypeError)
  })

  it('matches the WCAG reference values', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    expect(contrastRatio('#ffffff', '#777777')).toBe(contrastRatio('#777777', '#ffffff'))
  })
})
