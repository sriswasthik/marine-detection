import { describe, expect, it } from 'vitest'
import { geometryToSvgPath } from './svgMask'

const bounds = { north: 11, south: 10, east: 81, west: 80 }

describe('geometryToSvgPath', () => {
  it('maps corners of the bounds to the corners of the view box, north up', () => {
    const path = geometryToSvgPath(
      {
        type: 'Polygon',
        coordinates: [
          [
            [80, 11],
            [81, 11],
            [81, 10],
            [80, 11],
          ],
        ],
      },
      bounds,
      200,
      100,
    )
    expect(path).toBe('M0 0L200 0L200 100L0 0Z')
  })

  it('draws every ring of every polygon, holes included', () => {
    const square = (x: number) => [
      [80 + x, 10.5],
      [80.1 + x, 10.5],
      [80.1 + x, 10.6],
      [80 + x, 10.5],
    ]
    const path = geometryToSvgPath(
      { type: 'MultiPolygon', coordinates: [[square(0), square(0.5)], [square(0.2)]] },
      bounds,
      100,
      100,
    )
    expect(path.match(/M/g)).toHaveLength(3)
  })

  it('returns an empty path for degenerate bounds or size', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [80, 10],
          [80.5, 10],
          [80.5, 10.5],
          [80, 10],
        ],
      ],
    }
    expect(geometryToSvgPath(geometry, { ...bounds, east: 80 }, 100, 100)).toBe('')
    expect(geometryToSvgPath(geometry, bounds, 0, 100)).toBe('')
  })
})
