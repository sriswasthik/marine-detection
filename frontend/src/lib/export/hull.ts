import type { Position } from 'geojson'

/**
 * Convex hull of [lng, lat] points (Andrew's monotone chain), as a closed GeoJSON ring.
 * Counterclockwise, as RFC 7946 requires for exterior rings. Null for fewer than three distinct,
 * non-collinear points.
 */
export function convexHullRing(points: readonly Position[]): Position[] | null {
  const unique = [
    ...new Map(points.map(([x = 0, y = 0]) => [`${x},${y}`, [x, y] as Position])).values(),
  ].sort(([ax = 0, ay = 0], [bx = 0, by = 0]) => ax - bx || ay - by)
  if (unique.length < 3) return null

  const cross = (o: Position, a: Position, b: Position) =>
    ((a[0] ?? 0) - (o[0] ?? 0)) * ((b[1] ?? 0) - (o[1] ?? 0)) -
    ((a[1] ?? 0) - (o[1] ?? 0)) * ((b[0] ?? 0) - (o[0] ?? 0))

  const half = (input: Position[]) => {
    const chain: Position[] = []
    for (const point of input) {
      while (chain.length >= 2) {
        const a = chain[chain.length - 2]
        const b = chain[chain.length - 1]
        if (a && b && cross(a, b, point) <= 0) chain.pop()
        else break
      }
      chain.push(point)
    }
    chain.pop()
    return chain
  }

  const hull = [...half(unique), ...half([...unique].reverse())]
  if (hull.length < 3) return null
  const first = hull[0]
  return first ? [...hull, [...first]] : null
}
