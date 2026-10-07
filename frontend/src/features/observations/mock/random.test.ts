import { describe, expect, it } from 'vitest'
import { createRandom, hashString } from './random'

const take = (seed: number | string, n: number) => {
  const rng = createRandom(seed)
  return Array.from({ length: n }, () => rng.next())
}

describe('seeded random', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take('ennore', 50)).toEqual(take('ennore', 50))
    expect(take(42, 50)).toEqual(take(42, 50))
  })

  it('produces different sequences for different seeds', () => {
    expect(take('ennore', 10)).not.toEqual(take('mahim', 10))
  })

  it('hashes strings deterministically to unsigned 32-bit integers', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
    expect(Number.isInteger(hashString('x'))).toBe(true)
    expect(hashString('x')).toBeGreaterThanOrEqual(0)
  })

  it('keeps values within their ranges', () => {
    const rng = createRandom('ranges')
    for (let i = 0; i < 1000; i++) {
      const u = rng.next()
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
      const n = rng.int(6, 12)
      expect(n).toBeGreaterThanOrEqual(6)
      expect(n).toBeLessThanOrEqual(12)
      expect(Number.isInteger(n)).toBe(true)
      expect(rng.logNormal(100, 0.8)).toBeGreaterThan(0)
    }
  })

  it('centres the normal and log-normal distributions as described', () => {
    const rng = createRandom('distribution')
    const normals = Array.from({ length: 5000 }, () => rng.normal(10, 2))
    const mean = normals.reduce((a, b) => a + b, 0) / normals.length
    expect(mean).toBeCloseTo(10, 0)
    const logs = Array.from({ length: 5001 }, () => rng.logNormal(500, 0.7)).sort((a, b) => a - b)
    const median = logs[2500] ?? 0
    expect(median).toBeGreaterThan(450)
    expect(median).toBeLessThan(550)
  })

  it('picks from lists and refuses empty ones', () => {
    const rng = createRandom('pick')
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']))
    expect(() => rng.pick([])).toThrow(RangeError)
  })
})
