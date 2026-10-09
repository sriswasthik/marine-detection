import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { analyzeObservation } from '@/lib/analysis'
import { gridCellSizeForResolution } from '@/lib/config'
import { computeDensityGrid, observationDensityLevel } from '@/lib/density'
import { boundsContain, countVertices, geometryAreaM2 } from '@/lib/geo'
import { isSimpleRing, ringSignedArea, ringsOverlap, type Point } from '@/lib/polygon'
import { parseObservation } from '../schemas'
import type { Detection, Observation } from '../types'
import { generateObservation } from './generator'
import {
  getSampleObservation,
  getSampleObservations,
  HERO_SAMPLE_ID,
  pickSampleIdForUpload,
  SAMPLE_IDS,
  SAMPLE_SCENE_SPECS,
} from './samples'

const samples = getSampleObservations()

function sample(id: string): Observation {
  const found = getSampleObservation(id)
  if (!found) throw new Error(`Missing sample ${id}`)
  return found
}

function outerRing(detection: Detection): Point[] {
  if (detection.geometry.type !== 'Polygon') throw new Error('Mock detections are polygons')
  const ring = detection.geometry.coordinates[0] ?? []
  return ring.map((p: Position): Point => [p[0] ?? NaN, p[1] ?? NaN])
}

describe('mock determinism', () => {
  it('generates identical output from the same spec', () => {
    for (const spec of SAMPLE_SCENE_SPECS) {
      expect(generateObservation(spec)).toEqual(generateObservation(spec))
    }
  })

  it('generates different output from a different seed', () => {
    const spec = SAMPLE_SCENE_SPECS[0]
    if (!spec) throw new Error('No specs')
    const a = generateObservation(spec)
    const b = generateObservation({ ...spec, seed: `${spec.seed}-other` })
    expect(a.detections).not.toEqual(b.detections)
  })
})

describe.each(samples.map((o) => [o.id, o] as const))('sample %s', (_id, observation) => {
  const bounds = observation.bounds
  const resolution = observation.resolutionM ?? 10

  it('passes schema validation', () => {
    expect(parseObservation(observation).status).toBe('valid')
  })

  it('has valid, closed, counter-clockwise polygons with 4 to 12 vertices', () => {
    for (const detection of observation.detections) {
      const ring = outerRing(detection)
      expect(ring[0]).toEqual(ring[ring.length - 1])
      const vertices = countVertices(detection.geometry)
      expect(vertices).toBeGreaterThanOrEqual(4)
      expect(vertices).toBeLessThanOrEqual(12)
      // Anything of 10 pixels or more keeps at least 6 vertices after snapping.
      if (detection.sourcePixelCount >= 10) expect(vertices).toBeGreaterThanOrEqual(6)
      expect(isSimpleRing(ring)).toBe(true)
      expect(ringSignedArea(ring)).toBeGreaterThan(0)
    }
  })

  it('keeps every vertex and centroid inside the bounds', () => {
    if (!bounds) throw new Error('Samples have bounds')
    for (const detection of observation.detections) {
      for (const [lng, lat] of outerRing(detection)) {
        expect(boundsContain(bounds, { lat, lng })).toBe(true)
      }
      expect(boundsContain(bounds, detection.centroid)).toBe(true)
    }
  })

  it('never overlaps two detections', () => {
    const rings = observation.detections.map(outerRing)
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        expect(ringsOverlap(rings[i] ?? [], rings[j] ?? [])).toBe(false)
      }
    }
  })

  it('keeps areas and pixel counts self-consistent', () => {
    const pixelArea = resolution ** 2
    for (const detection of observation.detections) {
      expect(detection.areaM2).toBeCloseTo(geometryAreaM2(detection.geometry), 3)
      expect(detection.sourcePixelCount).toBe(Math.round(detection.areaM2 / pixelArea))
      expect(detection.areaM2).toBeGreaterThanOrEqual(1.9 * pixelArea)
      expect(detection.areaM2).toBeLessThanOrEqual(150.5 * pixelArea)
    }
    const total = observation.detections.reduce((sum, d) => sum + d.areaM2, 0)
    expect(observation.debrisAreaM2).toBeCloseTo(total, 3)
    expect(observation.coveragePercent).toBeCloseTo(
      (observation.debrisAreaM2 / observation.waterAreaM2) * 100,
      5,
    )
  })

  it('derives the water area from the bounds', () => {
    const spec = SAMPLE_SCENE_SPECS.find((s) => s.id === observation.id)
    if (!spec) throw new Error('Spec missing')
    const expected = spec.sizePx[0] * spec.sizePx[1] * resolution ** 2
    expect(Math.abs(observation.waterAreaM2 - expected) / expected).toBeLessThan(1e-4)
  })

  it('assigns density levels from the grid', () => {
    if (!bounds) throw new Error('Samples have bounds')
    const grid = computeDensityGrid(
      observation.detections,
      bounds,
      gridCellSizeForResolution(resolution),
    )
    expect(observation.densityLevel).toBe(observationDensityLevel(grid))
    for (const detection of observation.detections) {
      expect(detection.densityLevel).toBe(grid.detectionLevels[detection.id])
    }
  })

  it('keeps confidence in range and the average consistent', () => {
    const n = observation.detections.length
    for (const d of observation.detections) {
      expect(d.confidence).toBeGreaterThanOrEqual(0.3)
      expect(d.confidence).toBeLessThanOrEqual(0.99)
    }
    if (n === 0) {
      expect(observation.averageConfidence).toBeNull()
    } else {
      const mean = observation.detections.reduce((s, d) => s + d.confidence, 0) / n
      expect(observation.averageConfidence).toBeCloseTo(mean, 3)
    }
  })

  it('labels model metrics as placeholders', () => {
    expect(observation.modelMetrics?.isPlaceholder).toBe(true)
    expect(observation.modelMetrics?.benchmark).toBe(
      'Placeholder values, replace with project evaluation results',
    )
  })
})

describe('sample scenes tell the intended stories', () => {
  it('Ennore is the hero: about 60 detections and 3 strong hotspots', () => {
    const ennore = sample(SAMPLE_IDS.ennore)
    expect(ennore.detections.length).toBeGreaterThanOrEqual(55)
    expect(ennore.detections.length).toBeLessThanOrEqual(65)
    const { hotspots } = analyzeObservation(ennore)
    expect(hotspots).toHaveLength(3)
    expect(hotspots.every((h) => h.level === 'high' || h.level === 'critical')).toBe(true)
    expect(ennore.densityLevel).toBe('critical')
  })

  it('Ennore confidence rises with detection size', () => {
    const sorted = [...sample(SAMPLE_IDS.ennore).detections].sort((a, b) => a.areaM2 - b.areaM2)
    const quarter = Math.floor(sorted.length / 4)
    const mean = (list: Detection[]) => list.reduce((s, d) => s + d.confidence, 0) / list.length
    expect(mean(sorted.slice(-quarter))).toBeGreaterThan(mean(sorted.slice(0, quarter)))
  })

  it('Mahim Bay is a Sentinel-2 scene at Moderate density', () => {
    const mahim = sample(SAMPLE_IDS.mahim)
    expect(mahim.source).toBe('satellite')
    expect(mahim.resolutionM).toBe(10)
    expect(mahim.densityLevel).toBe('moderate')
    expect(mahim.detections.length).toBeGreaterThanOrEqual(20)
    expect(mahim.detections.length).toBeLessThanOrEqual(30)
    expect(Math.max(...mahim.detections.map((d) => d.areaM2))).toBeLessThan(5000)
  })

  it('every sample is a satellite scene, the only imagery the model accepts', () => {
    expect(samples.every((s) => s.source === 'satellite' && s.resolutionM === 10)).toBe(true)
  })

  it('Vembanad Lake is Low density', () => {
    const vembanad = sample(SAMPLE_IDS.vembanad)
    expect(vembanad.detections.length).toBeGreaterThan(0)
    expect(vembanad.densityLevel).toBe('low')
    expect(analyzeObservation(vembanad).hotspots).toEqual([])
  })

  it('Gulf of Mannar is a valid no-debris result', () => {
    const mannar = sample(SAMPLE_IDS.mannar)
    expect(mannar.status).toBe('completed')
    expect(mannar.detections).toEqual([])
    expect(mannar.debrisAreaM2).toBe(0)
    expect(mannar.coveragePercent).toBe(0)
    expect(mannar.densityLevel).toBeNull()
    expect(mannar.waterAreaM2).toBeGreaterThan(0)
  })

  it('Visakhapatnam carries low confidence and cloud warnings', () => {
    const vizag = sample(SAMPLE_IDS.visakhapatnam)
    expect(vizag.warnings).toEqual(['LOW_CONFIDENCE', 'HIGH_CLOUD'])
    expect(vizag.averageConfidence ?? 1).toBeLessThan(0.55)
    const low = vizag.detections.filter((d) => d.confidence < 0.5).length
    expect(low / vizag.detections.length).toBeGreaterThan(0.4)
  })

  it('Sundarbans is partially georeferenced', () => {
    const sundarbans = sample(SAMPLE_IDS.sundarbans)
    expect(sundarbans.status).toBe('partial')
    expect(sundarbans.crs).toBeNull()
    expect(sundarbans.bounds).not.toBeNull()
    expect(sundarbans.warnings).toEqual(['PARTIAL_GEOREF'])
  })

  it('lists samples newest first with distinct dates', () => {
    const dates = samples.map((s) => s.capturedAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(new Set(dates).size).toBe(dates.length)
  })
})

describe('pickSampleIdForUpload', () => {
  it('lets the scenario decide first', () => {
    expect(
      pickSampleIdForUpload({ fileName: 'ennore.tif', source: 'satellite', scenario: 'nodebris' }),
    ).toBe(SAMPLE_IDS.mannar)
    expect(
      pickSampleIdForUpload({ fileName: 'x.tif', source: 'satellite', scenario: 'lowconf' }),
    ).toBe(SAMPLE_IDS.visakhapatnam)
    expect(
      pickSampleIdForUpload({ fileName: 'x.tif', source: 'satellite', scenario: 'partial' }),
    ).toBe(SAMPLE_IDS.sundarbans)
  })

  it('then uses file name keywords, then the hero', () => {
    expect(
      pickSampleIdForUpload({
        fileName: 'Vizag_2026.tif',
        source: 'satellite',
        scenario: 'success',
      }),
    ).toBe(SAMPLE_IDS.visakhapatnam)
    expect(
      pickSampleIdForUpload({
        fileName: 'mahim-bay.tif',
        source: 'satellite',
        scenario: 'success',
      }),
    ).toBe(SAMPLE_IDS.mahim)
    expect(
      pickSampleIdForUpload({ fileName: 'scene.tif', source: 'satellite', scenario: 'success' }),
    ).toBe(HERO_SAMPLE_ID)
  })
})
