import type { MultiPolygon, Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import {
  bboxToBounds,
  boundsAreaM2,
  boundsCenter,
  boundsContain,
  boundsOfGeometries,
  boundsToBBox,
  boundsToLeaflet,
  boundsToPolygon,
  countVertices,
  createLocalProjection,
  degreesToMeters,
  geometryAreaM2,
  geometryBounds,
  geometryCentroid,
  geometryToLeaflet,
  haversineDistanceM,
  latLngToPosition,
  latLngToTuple,
  leafletToBounds,
  metersPerDegreeLat,
  metersPerDegreeLng,
  metersToDegrees,
  positionToLatLng,
  ringToLeaflet,
  toLatLngTuple,
  toLngLatPosition,
  tupleToLatLng,
  unionBounds,
} from './geo'

const ennore = { lat: 13.22, lng: 80.368 }
const square: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [80.0, 13.0],
      [80.01, 13.0],
      [80.01, 13.01],
      [80.0, 13.01],
      [80.0, 13.0],
    ],
  ],
}

describe('coordinate order', () => {
  it('converts GeoJSON [lng, lat] to Leaflet [lat, lng]', () => {
    expect(toLatLngTuple([80.368, 13.22])).toEqual([13.22, 80.368])
  })

  it('converts Leaflet [lat, lng] to GeoJSON [lng, lat]', () => {
    expect(toLngLatPosition([13.22, 80.368])).toEqual([80.368, 13.22])
  })

  it('round trips through both orders without change', () => {
    const position: [number, number] = [-122.4194, 37.7749]
    expect(toLngLatPosition(toLatLngTuple(position))).toEqual(position)
    expect(latLngToPosition(positionToLatLng(position))).toEqual(position)
    expect(tupleToLatLng(latLngToTuple(ennore))).toEqual(ennore)
  })

  it('maps objects to the right order', () => {
    expect(latLngToTuple(ennore)).toEqual([13.22, 80.368])
    expect(latLngToPosition(ennore)).toEqual([80.368, 13.22])
    expect(positionToLatLng([80.368, 13.22])).toEqual(ennore)
  })

  it('rejects positions with missing values', () => {
    expect(() => toLatLngTuple([80])).toThrow(/latitude/)
  })

  it('converts rings and geometries to nested Leaflet arrays', () => {
    const ring = square.coordinates[0] ?? []
    expect(ringToLeaflet(ring)[1]).toEqual([13.0, 80.01])
    expect(geometryToLeaflet(square)).toHaveLength(1)
    const multi: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [square.coordinates, square.coordinates],
    }
    const leaflet = geometryToLeaflet(multi)
    expect(leaflet).toHaveLength(2)
    expect(leaflet[1]?.[0]?.[2]).toEqual([13.01, 80.01])
  })
})

describe('bounds', () => {
  const bounds = { north: 13.25, south: 13.2, east: 80.4, west: 80.33 }

  it('converts to and from Leaflet bounds', () => {
    expect(boundsToLeaflet(bounds)).toEqual([
      [13.2, 80.33],
      [13.25, 80.4],
    ])
    expect(leafletToBounds(boundsToLeaflet(bounds))).toEqual(bounds)
  })

  it('converts to and from GeoJSON bbox order', () => {
    expect(boundsToBBox(bounds)).toEqual([80.33, 13.2, 80.4, 13.25])
    expect(bboxToBounds(boundsToBBox(bounds))).toEqual(bounds)
    expect(bboxToBounds([80.33, 13.2, 0, 80.4, 13.25, 10])).toEqual(bounds)
  })

  it('computes geometry bounds, unions, centres and containment', () => {
    expect(geometryBounds(square)).toEqual({ north: 13.01, south: 13.0, east: 80.01, west: 80.0 })
    expect(unionBounds(bounds, { north: 14, south: 13.3, east: 80.5, west: 80.35 })).toEqual({
      north: 14,
      south: 13.2,
      east: 80.5,
      west: 80.33,
    })
    expect(boundsCenter(bounds).lat).toBeCloseTo(13.225, 10)
    expect(boundsContain(bounds, ennore)).toBe(true)
    expect(boundsContain(bounds, { lat: 13.3, lng: 80.368 })).toBe(false)
    expect(boundsOfGeometries([])).toBeNull()
    expect(boundsOfGeometries([square])).toEqual(geometryBounds(square))
  })

  it('builds a closed counter-clockwise polygon', () => {
    const ring = boundsToPolygon(bounds).coordinates[0] ?? []
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
  })
})

describe('measurement', () => {
  it('measures one degree of latitude as about 111 km', () => {
    const d = haversineDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
    expect(haversineDistanceM(ennore, ennore)).toBe(0)
  })

  it('uses the spherical meters-per-degree values that match turf', () => {
    expect(metersPerDegreeLat(0)).toBeCloseTo(111_195, 0)
    expect(metersPerDegreeLat(45)).toBe(metersPerDegreeLat(0))
    expect(metersPerDegreeLng(0)).toBeCloseTo(111_195, 0)
    expect(metersPerDegreeLng(60)).toBeCloseTo(55_597.5, 0)
    // One degree of latitude by haversine equals the per-degree factor.
    expect(haversineDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      metersPerDegreeLat(),
      3,
    )
  })

  it('round trips meters and degrees', () => {
    const degrees = metersToDegrees({ dxM: 250, dyM: -125 }, 13.22)
    const meters = degreesToMeters(degrees, 13.22)
    expect(meters.dxM).toBeCloseTo(250, 9)
    expect(meters.dyM).toBeCloseTo(-125, 9)
  })

  it('round trips the local projection', () => {
    const projection = createLocalProjection({ lat: 13.2, lng: 80.33 })
    const [x, y] = projection.toMeters([80.34, 13.21])
    const [lng, lat] = projection.toPosition([x, y])
    expect(lng).toBeCloseTo(80.34, 12)
    expect(lat).toBeCloseTo(13.21, 12)
  })

  it('computes areas consistent with the local projection', () => {
    const projection = createLocalProjection({ lat: 13, lng: 80 }, 13.005)
    const [w, h] = projection.toMeters([80.01, 13.01])
    expect(geometryAreaM2(square) / (w * h)).toBeCloseTo(1, 5)
    const bounds = geometryBounds(square)
    expect(boundsAreaM2(bounds)).toBeCloseTo(geometryAreaM2(square), 0)
  })

  it('counts distinct vertices, ignoring the closing vertex', () => {
    expect(countVertices(square)).toBe(4)
    expect(
      countVertices({
        type: 'MultiPolygon',
        coordinates: [square.coordinates, square.coordinates],
      }),
    ).toBe(8)
  })

  it('finds the centroid of a square', () => {
    const c = geometryCentroid(square)
    expect(c.lat).toBeCloseTo(13.005, 10)
    expect(c.lng).toBeCloseTo(80.005, 10)
  })
})
