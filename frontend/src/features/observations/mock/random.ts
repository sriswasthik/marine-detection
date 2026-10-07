/** Deterministic pseudo-random numbers for the mock backend. Same seed, same sequence. */

/** 32-bit FNV-1a hash of a string. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export interface Random {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** Normal distribution (Box-Muller). */
  normal(mean?: number, standardDeviation?: number): number
  /** Log-normal distribution described by its median and the sigma of the underlying normal. */
  logNormal(median: number, sigma: number): number
  chance(probability: number): boolean
  pick<T>(items: readonly T[]): T
}

/** Mulberry32 generator seeded from a number or a string. */
export function createRandom(seed: number | string): Random {
  let state = typeof seed === 'string' ? hashString(seed) : seed >>> 0

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const normal = (mean = 0, standardDeviation = 1) => {
    const u = 1 - next() // (0, 1], keeps log finite
    const v = next()
    return mean + standardDeviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    normal,
    logNormal: (median, sigma) => median * Math.exp(normal(0, sigma)),
    chance: (probability) => next() < probability,
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)]
      if (item === undefined) throw new RangeError('Cannot pick from an empty list.')
      return item
    },
  }
}
