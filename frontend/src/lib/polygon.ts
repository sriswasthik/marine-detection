/**
 * Planar polygon helpers for local metric or pixel coordinates (x east, y north).
 * Rings here are open: the closing vertex is not repeated. Geographic work lives in geo.ts.
 */

export type Point = readonly [x: number, y: number]

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function at(ring: readonly Point[], index: number): Point {
  const point = ring[((index % ring.length) + ring.length) % ring.length]
  if (!point) throw new RangeError('Ring index out of range.')
  return point
}

/** Drops a repeated closing vertex if present. */
export function openRing(ring: readonly Point[]): Point[] {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (ring.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1)
  }
  return [...ring]
}

/** Shoelace area. Positive for counter-clockwise rings. Accepts open or closed rings. */
export function ringSignedArea(ring: readonly Point[]): number {
  const points = openRing(ring)
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = at(points, i)
    const [x2, y2] = at(points, i + 1)
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

export function ringArea(ring: readonly Point[]): number {
  return Math.abs(ringSignedArea(ring))
}

/** Removes consecutive duplicate vertices, including a duplicate between last and first. */
export function dedupeRing(ring: readonly Point[]): Point[] {
  const result: Point[] = []
  for (const point of openRing(ring)) {
    const prev = result[result.length - 1]
    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) result.push(point)
  }
  while (result.length > 1) {
    const first = result[0]
    const last = result[result.length - 1]
    if (first && last && first[0] === last[0] && first[1] === last[1]) result.pop()
    else break
  }
  return result
}

export function ringBBox(ring: readonly Point[]): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

export function rectsOverlap(a: Rect, b: Rect, padding = 0): boolean {
  return (
    a.minX - padding <= b.maxX &&
    b.minX - padding <= a.maxX &&
    a.minY - padding <= b.maxY &&
    b.minY - padding <= a.maxY
  )
}

function cross(o: Point, a: Point, b: Point): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function onSegment(p: Point, a: Point, b: Point): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  )
}

/** True when segments ab and cd share any point, touching and collinear overlap included. */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  if (d1 === 0 && onSegment(a, c, d)) return true
  if (d2 === 0 && onSegment(b, c, d)) return true
  if (d3 === 0 && onSegment(c, a, b)) return true
  if (d4 === 0 && onSegment(d, a, b)) return true
  return false
}

/**
 * True when the ring has at least three vertices, non-zero area, no self-intersections,
 * no repeated vertices and no spikes (an edge folding back over the previous one).
 */
export function isSimpleRing(ring: readonly Point[]): boolean {
  const points = openRing(ring)
  const n = points.length
  if (n < 3 || ringArea(points) === 0) return false
  for (let i = 0; i < n; i++) {
    const a = at(points, i)
    const b = at(points, i + 1)
    if (a[0] === b[0] && a[1] === b[1]) return false
    const c = at(points, i + 2)
    // Adjacent edges: reject a fold-back along the same line.
    if (cross(a, b, c) === 0) {
      const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])
      if (dot < 0) return false
    }
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (segmentsIntersect(a, b, at(points, j), at(points, j + 1))) return false
    }
  }
  return true
}

/** Ray casting. Points exactly on an edge may report either side. */
export function pointInRing(point: Point, ring: readonly Point[]): boolean {
  const points = openRing(ring)
  const [px, py] = point
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = at(points, i)
    const [xj, yj] = at(points, j)
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** True when two simple rings intersect, touch, or one contains the other. */
export function ringsOverlap(a: readonly Point[], b: readonly Point[]): boolean {
  const ra = openRing(a)
  const rb = openRing(b)
  if (!rectsOverlap(ringBBox(ra), ringBBox(rb))) return false
  for (let i = 0; i < ra.length; i++) {
    for (let j = 0; j < rb.length; j++) {
      if (segmentsIntersect(at(ra, i), at(ra, i + 1), at(rb, j), at(rb, j + 1))) return true
    }
  }
  const firstA = ra[0]
  const firstB = rb[0]
  return Boolean((firstA && pointInRing(firstA, rb)) || (firstB && pointInRing(firstB, ra)))
}

/**
 * Sutherland-Hodgman clip of a ring against an axis-aligned rectangle. The subject may be
 * concave; the result can contain zero-width slivers, but its area is exact.
 */
export function clipRingToRect(ring: readonly Point[], rect: Rect): Point[] {
  type Edge = { inside: (p: Point) => boolean; intersect: (p: Point, q: Point) => Point }
  const edges: Edge[] = [
    {
      inside: (p) => p[0] >= rect.minX,
      intersect: (p, q) => [rect.minX, p[1] + ((q[1] - p[1]) * (rect.minX - p[0])) / (q[0] - p[0])],
    },
    {
      inside: (p) => p[0] <= rect.maxX,
      intersect: (p, q) => [rect.maxX, p[1] + ((q[1] - p[1]) * (rect.maxX - p[0])) / (q[0] - p[0])],
    },
    {
      inside: (p) => p[1] >= rect.minY,
      intersect: (p, q) => [p[0] + ((q[0] - p[0]) * (rect.minY - p[1])) / (q[1] - p[1]), rect.minY],
    },
    {
      inside: (p) => p[1] <= rect.maxY,
      intersect: (p, q) => [p[0] + ((q[0] - p[0]) * (rect.maxY - p[1])) / (q[1] - p[1]), rect.maxY],
    },
  ]

  let output: Point[] = openRing(ring)
  for (const edge of edges) {
    const input = output
    output = []
    for (let i = 0; i < input.length; i++) {
      const current = at(input, i)
      const previous = at(input, i - 1)
      if (edge.inside(current)) {
        if (!edge.inside(previous)) output.push(edge.intersect(previous, current))
        output.push(current)
      } else if (edge.inside(previous)) {
        output.push(edge.intersect(previous, current))
      }
    }
    if (output.length === 0) break
  }
  return output
}
