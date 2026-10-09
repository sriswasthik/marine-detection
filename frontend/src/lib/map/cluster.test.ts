import { describe, expect, it } from 'vitest'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { CLUSTER_CELL_PX, CLUSTER_THRESHOLD, clusterPoints, type ScreenPoint } from './cluster'
import { mapStatusText } from './status'

/** `count` points spread one per cell, so nothing would merge on position alone. */
const spread = (count: number): ScreenPoint[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `d${String(i).padStart(3, '0')}`,
    x: (i % 10) * CLUSTER_CELL_PX * 2 + 5,
    y: Math.floor(i / 10) * CLUSTER_CELL_PX * 2 + 5,
    level: DENSITY_LEVEL_IDS[i % 4] ?? 'low',
  }))

/** `count` points packed into one cell. */
const packed = (count: number, prefix: string, x: number, y: number): ScreenPoint[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i}`,
    x: x + (i % 5),
    y: y + Math.floor(i / 5),
    level: i === 3 ? 'critical' : 'low',
  }))

describe('clusterPoints', () => {
  it('draws every marker on its own up to the threshold, however close they are', () => {
    const points = packed(CLUSTER_THRESHOLD, 'p', 10, 10)
    const result = clusterPoints(points)
    expect(result.clusters).toHaveLength(0)
    expect(result.singles).toHaveLength(CLUSTER_THRESHOLD)
  })

  it('merges markers that share a cell into counted clusters above the threshold', () => {
    const points = [...packed(25, 'a', 10, 10), ...packed(20, 'b', 400, 400)]
    expect(points.length).toBeGreaterThan(CLUSTER_THRESHOLD)
    const { singles, clusters } = clusterPoints(points)
    expect(singles).toHaveLength(0)
    expect(clusters.map((c) => c.count).sort((x, y) => x - y)).toEqual([20, 25])
    expect(clusters.reduce((sum, c) => sum + c.count, 0)).toBe(points.length)
  })

  it('colours a cluster by its most severe member and places it at their mean', () => {
    const points = [...packed(30, 'a', 10, 10), ...spread(15).map((p) => ({ ...p, x: p.x + 600 }))]
    const cluster = clusterPoints(points).clusters.find((c) => c.count === 30)
    expect(cluster?.level).toBe('critical')
    expect(cluster?.x).toBeGreaterThan(10)
    expect(cluster?.x).toBeLessThan(15)
  })

  it('keeps pairs as two markers: only three or more in a cell merge', () => {
    const pairs = Array.from({ length: 21 }, (_, i) => packed(2, `p${i}-`, i * 100, 10)).flat()
    expect(pairs.length).toBeGreaterThan(CLUSTER_THRESHOLD)
    const { singles, clusters } = clusterPoints(pairs)
    expect(clusters).toHaveLength(0)
    expect(singles).toHaveLength(pairs.length)
  })

  it('keeps lone markers above the threshold as singles', () => {
    const { singles, clusters } = clusterPoints(spread(CLUSTER_THRESHOLD + 5))
    expect(clusters).toHaveLength(0)
    expect(singles).toHaveLength(CLUSTER_THRESHOLD + 5)
  })

  it('gives the same members the same cluster id', () => {
    const points = packed(45, 'a', 10, 10)
    const first = clusterPoints(points).clusters[0]?.id
    const again = clusterPoints([...points].reverse()).clusters[0]?.id
    expect(first).toBeDefined()
    expect(again).toBe(first)
  })
})

describe('mapStatusText', () => {
  it('counts detections and hotspots', () => {
    expect(mapStatusText({ shown: 61, total: 61, hotspots: 3, filtered: false })).toBe(
      '61 detections · 3 hotspots',
    )
  })

  it('says how many are shown while filters hide some', () => {
    expect(mapStatusText({ shown: 42, total: 61, hotspots: 2, filtered: true })).toBe(
      '42 of 61 detections · 2 hotspots',
    )
    expect(mapStatusText({ shown: 61, total: 61, hotspots: 3, filtered: true })).toBe(
      '61 detections · 3 hotspots',
    )
  })

  it('uses the singular and names a clear result', () => {
    expect(mapStatusText({ shown: 1, total: 1, hotspots: 1, filtered: false })).toBe(
      '1 detection · 1 hotspot',
    )
    expect(mapStatusText({ shown: 0, total: 0, hotspots: 0, filtered: false })).toBe(
      'No debris detected',
    )
  })
})
