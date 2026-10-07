import { describe, expect, it } from 'vitest'
import {
  clipRingToRect,
  dedupeRing,
  isSimpleRing,
  openRing,
  pointInRing,
  ringArea,
  ringSignedArea,
  ringsOverlap,
  segmentsIntersect,
  type Point,
} from './polygon'

const square: Point[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

describe('polygon helpers', () => {
  it('computes signed area by orientation', () => {
    expect(ringSignedArea(square)).toBe(100)
    expect(ringSignedArea([...square].reverse())).toBe(-100)
    expect(ringArea([...square, [0, 0]])).toBe(100)
  })

  it('opens closed rings and removes repeated vertices', () => {
    expect(openRing([...square, [0, 0]])).toHaveLength(4)
    expect(
      dedupeRing([
        [0, 0],
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
  })

  it('detects crossing, touching and separate segments', () => {
    expect(segmentsIntersect([0, 0], [2, 2], [0, 2], [2, 0])).toBe(true)
    expect(segmentsIntersect([0, 0], [1, 0], [1, 0], [2, 1])).toBe(true)
    expect(segmentsIntersect([0, 0], [1, 0], [0, 1], [1, 1])).toBe(false)
    expect(segmentsIntersect([0, 0], [2, 0], [1, 0], [3, 0])).toBe(true)
  })

  it('recognises simple and non-simple rings', () => {
    expect(isSimpleRing(square)).toBe(true)
    const bowtie: Point[] = [
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ]
    expect(isSimpleRing(bowtie)).toBe(false)
    expect(
      isSimpleRing([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBe(false)
    const spike: Point[] = [
      [0, 0],
      [4, 0],
      [2, 0],
      [2, 3],
    ]
    expect(isSimpleRing(spike)).toBe(false)
  })

  it('tests point containment and ring overlap', () => {
    expect(pointInRing([5, 5], square)).toBe(true)
    expect(pointInRing([15, 5], square)).toBe(false)
    const inner: Point[] = [
      [2, 2],
      [3, 2],
      [3, 3],
    ]
    expect(ringsOverlap(square, inner)).toBe(true)
    expect(
      ringsOverlap(
        square,
        inner.map(([x, y]): Point => [x + 20, y]),
      ),
    ).toBe(false)
  })

  it('clips a ring to a rectangle with exact area', () => {
    const clipped = clipRingToRect(square, { minX: 5, minY: -5, maxX: 20, maxY: 5 })
    expect(ringArea(clipped)).toBe(25)
    expect(clipRingToRect(square, { minX: 20, minY: 20, maxX: 30, maxY: 30 })).toHaveLength(0)
  })

  it('clips a concave ring correctly', () => {
    const lShape: Point[] = [
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
      [2, 10],
      [0, 10],
    ]
    expect(ringArea(lShape)).toBe(36)
    expect(ringArea(clipRingToRect(lShape, { minX: 0, minY: 0, maxX: 5, maxY: 5 }))).toBe(16)
  })
})
