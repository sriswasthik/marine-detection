import type { Geometry, Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Detection, DetectionGeometry, Observation } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { filterDetections } from '@/lib/filters'
import { geometryAreaM2, geometryCentroid } from '@/lib/geo'
import { ringSignedArea } from '@/lib/polygon'
import {
  coordinateNote,
  detectionFeature,
  detectionsCollection,
  hotspotsCollection,
  toGeoJsonText,
  type ExportScope,
} from './geojson'
import { convexHullRing } from './hull'

function sample(id: string): Observation {
  const observation = getSampleObservation(id)
  if (!observation) throw new Error(`missing ${id}`)
  return observation
}

const hero = sample(SAMPLE_IDS.ennore)
const clear = sample(SAMPLE_IDS.mannar)
const scope: ExportScope = {
  generatedAt: '2026-10-08T00:00:00.000Z',
  generator: 'A.W.A.R.E.',
  sampleData: true,
  filters: null,
}

const rings = (geometry: Geometry): Position[][] =>
  geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat()
      : []

describe('detections GeoJSON', () => {
  const collection = detectionsCollection(hero, { hotspotCount: 3, scope })

  it('is a FeatureCollection with one Feature per detection', () => {
    expect(collection.type).toBe('FeatureCollection')
    expect(collection.features).toHaveLength(hero.detections.length)
    expect(collection.features.every((f) => f.type === 'Feature')).toBe(true)
    expect(collection.features.map((f) => f.id)).toEqual(hero.detections.map((d) => d.id))
  })

  it('writes positions as [lng, lat] inside the image bounds', () => {
    const b = hero.bounds
    if (!b) throw new Error('hero has bounds')
    for (const feature of collection.features) {
      for (const [lng = NaN, lat = NaN] of rings(feature.geometry).flat()) {
        // Ennore: longitude about 80.3, latitude about 13.2. Swapped order would fail both.
        expect(lng).toBeGreaterThanOrEqual(b.west - 1e-9)
        expect(lng).toBeLessThanOrEqual(b.east + 1e-9)
        expect(lat).toBeGreaterThanOrEqual(b.south - 1e-9)
        expect(lat).toBeLessThanOrEqual(b.north + 1e-9)
      }
    }
  })

  it('closes every ring with at least four positions', () => {
    for (const feature of collection.features) {
      for (const ring of rings(feature.geometry)) {
        expect(ring.length).toBeGreaterThanOrEqual(4)
        expect(ring[0]).toEqual(ring[ring.length - 1])
      }
    }
  })

  it('has the documented properties with the right types', () => {
    const [first] = collection.features
    if (!first) throw new Error('no features')
    expect(Object.keys(first.properties).sort()).toEqual(
      [
        'id',
        'observationId',
        'region',
        'source',
        'capturedAt',
        'areaM2',
        'confidence',
        'densityLevel',
        'centroidLat',
        'centroidLng',
        'sourcePixelCount',
      ].sort(),
    )
    const p = first.properties
    expect(typeof p.id).toBe('string')
    expect(p.observationId).toBe(hero.id)
    expect(['satellite', 'drone']).toContain(p.source)
    expect(Number.isNaN(Date.parse(p.capturedAt))).toBe(false)
    for (const value of [p.areaM2, p.confidence, p.centroidLat, p.centroidLng]) {
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(Number.isInteger(p.sourcePixelCount)).toBe(true)
    expect(['low', 'moderate', 'high', 'critical']).toContain(p.densityLevel)
  })

  it('carries an observation summary and explains the source CRS', () => {
    expect(collection.observation).toMatchObject({
      id: hero.id,
      sourceCrs: 'EPSG:32644',
      metrics: {
        detectedAreaM2: hero.debrisAreaM2,
        detectionCount: hero.detections.length,
        hotspotCount: 3,
      },
      export: { featureCount: hero.detections.length, filtered: false, sampleData: true },
    })
    expect(collection.observation.coordinateNote).toMatch(
      /converted from the source image's EPSG:32644/,
    )
    expect(coordinateNote('EPSG:4326')).toBeUndefined()
    expect(coordinateNote(null)).toMatch(/approximate/)
  })

  it('round-trips: parsed geometry gives back the centroids and areas within tolerance', () => {
    const parsed = JSON.parse(toGeoJsonText(collection)) as typeof collection
    const byId = new Map(hero.detections.map((d) => [d.id, d]))
    for (const feature of parsed.features) {
      const source = byId.get(feature.properties.id)
      if (!source) throw new Error(`unknown ${feature.properties.id}`)
      const geometry = feature.geometry as DetectionGeometry
      const centroid = geometryCentroid(geometry)
      expect(centroid.lat).toBeCloseTo(feature.properties.centroidLat, 5)
      expect(centroid.lng).toBeCloseTo(feature.properties.centroidLng, 5)
      // Areas: within 1% of the reported area (the source rounds geometry to 6 decimals).
      const area = geometryAreaM2(geometry)
      expect(Math.abs(area - source.areaM2) / source.areaM2).toBeLessThan(0.01)
      expect(feature.properties.areaM2).toBe(source.areaM2)
    }
  })

  it('exports a filtered subset, counts it, and says so', () => {
    const filtered = filterDetections(hero.detections, {
      minConfidence: 0.7,
      levels: ['high', 'critical'],
    })
    const result = detectionsCollection(hero, {
      detections: filtered,
      hotspotCount: 2,
      scope: { ...scope, filters: 'Confidence 70% or more; density High, Critical' },
    })
    expect(result.features).toHaveLength(filtered.length)
    expect(filtered.length).toBeLessThan(hero.detections.length)
    expect(result.observation.export).toMatchObject({
      featureCount: filtered.length,
      filtered: true,
      filters: 'Confidence 70% or more; density High, Critical',
    })
    // The summary still describes the whole observation.
    expect(result.observation.metrics.detectionCount).toBe(hero.detections.length)
    expect(
      result.features.every(
        (f) =>
          f.properties.confidence >= 0.7 &&
          ['high', 'critical'].includes(f.properties.densityLevel),
      ),
    ).toBe(true)
  })

  it('exports a no-debris observation as a valid, empty collection', () => {
    const empty = detectionsCollection(clear, { hotspotCount: 0, scope })
    expect(empty.type).toBe('FeatureCollection')
    expect(empty.features).toEqual([])
    expect(empty.observation.metrics.detectionCount).toBe(0)
    expect(JSON.parse(toGeoJsonText(empty))).toMatchObject({
      type: 'FeatureCollection',
      features: [],
    })
  })

  it('exports a single detection as a Feature', () => {
    const detection = hero.detections[0] as Detection
    expect(detectionFeature(detection, hero)).toMatchObject({
      type: 'Feature',
      id: detection.id,
      properties: { id: detection.id, observationId: hero.id },
    })
  })
})

describe('hotspots GeoJSON', () => {
  const analysis = analyzeObservation(hero)
  const collection = hotspotsCollection(hero, {
    hotspots: analysis.hotspots,
    grid: analysis.grid,
    scope,
  })

  it('has one closed, counterclockwise polygon per hotspot, in rank order', () => {
    expect(collection.features.map((f) => f.properties.rank)).toEqual(
      analysis.hotspots.map((h) => h.rank),
    )
    for (const feature of collection.features) {
      const [ring] = feature.geometry.coordinates
      if (!ring) throw new Error('no ring')
      expect(ring[0]).toEqual(ring[ring.length - 1])
      expect(ring.length).toBeGreaterThanOrEqual(4)
      const points = ring.map(([x = 0, y = 0]) => [x, y] as const)
      expect(ringSignedArea(points)).toBeGreaterThan(0)
    }
  })

  it('outlines every cell of the hotspot', () => {
    const grid = analysis.grid
    if (!grid) throw new Error('no grid')
    for (const [index, hotspot] of analysis.hotspots.entries()) {
      const [ring] = collection.features[index]?.geometry.coordinates ?? []
      const lngs = (ring ?? []).map(([lng = 0]) => lng)
      const lats = (ring ?? []).map(([, lat = 0]) => lat)
      for (const cell of grid.cells.filter((c) => hotspot.cellIds.includes(c.id))) {
        expect(Math.min(...lngs)).toBeLessThanOrEqual(cell.bounds.west + 1e-12)
        expect(Math.max(...lngs)).toBeGreaterThanOrEqual(cell.bounds.east - 1e-12)
        expect(Math.min(...lats)).toBeLessThanOrEqual(cell.bounds.south + 1e-12)
        expect(Math.max(...lats)).toBeGreaterThanOrEqual(cell.bounds.north - 1e-12)
      }
    }
  })

  it('has the documented properties', () => {
    const [first] = collection.features
    expect(first?.properties).toMatchObject({
      rank: 1,
      level: analysis.hotspots[0]?.level,
      totalAreaM2: analysis.hotspots[0]?.totalAreaM2,
      meanConfidence: analysis.hotspots[0]?.meanConfidence,
      priorityScore: analysis.hotspots[0]?.priorityScore,
    })
  })

  it('is a valid, empty collection without hotspots', () => {
    const empty = hotspotsCollection(clear, { hotspots: [], grid: null, scope })
    expect(empty.features).toEqual([])
  })
})

describe('convexHullRing', () => {
  it('returns the closed, counterclockwise hull and drops interior points', () => {
    const ring = convexHullRing([
      [0, 0],
      [2, 0],
      [1, 1],
      [2, 2],
      [0, 2],
      [0, 0],
    ])
    expect(ring).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ])
  })

  it('returns null for degenerate input', () => {
    expect(convexHullRing([[0, 0]])).toBeNull()
    expect(
      convexHullRing([
        [0, 0],
        [1, 1],
        [2, 2],
      ]),
    ).toBeNull()
  })
})
