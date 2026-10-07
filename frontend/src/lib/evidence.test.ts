import { describe, expect, it } from 'vitest'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Observation } from '@/features/observations/types'
import {
  densityShares,
  densitySummaryText,
  detectionFromParam,
  evidenceMetrics,
  evidenceSource,
  extentFacts,
  provenanceRows,
} from './evidence'
import { EMPTY_VALUE } from './format'
import { computeObservationStats } from './stats'

function sample(id: string): Observation {
  const observation = getSampleObservation(id)
  if (!observation) throw new Error(`missing sample ${id}`)
  return observation
}

const hero = sample(SAMPLE_IDS.ennore)
const clear = sample(SAMPLE_IDS.mannar)

const noNaN = (values: string[]) => values.every((value) => !/NaN|Infinity|undefined/.test(value))

describe('evidenceMetrics', () => {
  it('lists the six figures in order, each with a hint', () => {
    const metrics = evidenceMetrics(hero, 3)
    expect(metrics.map((m) => m.label)).toEqual([
      'Detected area',
      'Water area',
      'Coverage',
      'Average confidence',
      'Detected regions',
      'Hotspots',
    ])
    expect(metrics.every((m) => m.hint.length > 0)).toBe(true)
    expect(metrics.find((m) => m.id === 'detections')?.value).toBe(String(hero.detections.length))
    expect(metrics.find((m) => m.id === 'hotspots')?.value).toBe('3')
  })

  it('reads areas from the data contract in the chosen unit', () => {
    const area = (unit: 'm2' | 'ha' | 'km2') =>
      evidenceMetrics({ ...hero, debrisAreaM2: 12_345, waterAreaM2: 2_500_000 }, 0, unit)
    expect(area('m2')[0]?.value).toBe('12,345 m²')
    expect(area('ha')[0]?.value).toBe('1.23 ha')
    expect(area('km2')[1]?.value).toBe('2.50 km²')
    expect(area('ha')[1]?.value).toBe('250 ha')
  })

  it('shows real zeros for a no-debris observation, and never NaN', () => {
    const metrics = evidenceMetrics(clear, 0, 'm2')
    expect(metrics.find((m) => m.id === 'debrisArea')?.value).toBe('0 m²')
    expect(metrics.find((m) => m.id === 'coverage')?.value).toBe('0%')
    expect(metrics.find((m) => m.id === 'detections')?.value).toBe('0')
    expect(metrics.find((m) => m.id === 'hotspots')?.value).toBe('0')
    const confidence = metrics.find((m) => m.id === 'confidence')
    expect(confidence?.value).toBe(EMPTY_VALUE)
    expect(confidence?.footnote).toBe('No detections to average')
    expect(noNaN(metrics.flatMap((m) => [m.value, m.footnote ?? '']))).toBe(true)
  })
})

describe('densityShares', () => {
  it('splits debris area by level, Low to Critical, summing to 100', () => {
    const shares = densityShares(computeObservationStats(hero.detections).byLevel)
    expect(shares.map((s) => s.level)).toEqual(['low', 'moderate', 'high', 'critical'])
    expect(shares.reduce((sum, s) => sum + s.percent, 0)).toBeCloseTo(100, 6)
    const totalArea = shares.reduce((sum, s) => sum + s.areaM2, 0)
    expect(totalArea).toBeCloseTo(hero.debrisAreaM2, 2)
  })

  it('computes exact shares and readable labels', () => {
    const shares = densityShares([
      { level: 'low', detectionCount: 3, areaM2: 1, areaShare: 0 },
      { level: 'moderate', detectionCount: 1, areaM2: 0, areaShare: 0 },
      { level: 'high', detectionCount: 2, areaM2: 299, areaShare: 0 },
      { level: 'critical', detectionCount: 1, areaM2: 100, areaShare: 0 },
    ])
    expect(shares.map((s) => s.percent)).toEqual([0.25, 0, 74.75, 25])
    expect(shares.map((s) => s.percentLabel)).toEqual(['<1%', '0%', '75%', '25%'])
  })

  it('returns four zero shares without NaN when there is no debris', () => {
    const shares = densityShares(computeObservationStats([]).byLevel)
    expect(shares.map((s) => s.percent)).toEqual([0, 0, 0, 0])
    expect(shares.every((s) => s.percentLabel === '0%')).toBe(true)
  })

  it('describes the observation level in plain words', () => {
    expect(densitySummaryText('critical', 4)).toMatch(/^Priority hotspot\./)
    expect(densitySummaryText(null, 0)).toMatch(/No debris was detected/)
  })
})

describe('provenanceRows and extentFacts', () => {
  it('reads model, timing, resolution and cloud from the observation', () => {
    const rows = Object.fromEntries(provenanceRows(hero).map((r) => [r.label, r.value]))
    expect(rows.Model).toBe(`${hero.processing?.modelName} ${hero.processing?.modelVersion}`)
    expect(rows.Duration).toBe('47 s')
    expect(rows.Resolution).toBe('10 m per pixel')
    expect(rows['Cloud coverage']).toBe('6.0%')
    expect(rows['Source ID']).toBe(hero.id)
  })

  it('says "Not recorded" for missing facts', () => {
    const rows = provenanceRows({ id: 'obs-x', processing: undefined })
    expect(rows.filter((r) => r.value === 'Not recorded').map((r) => r.label)).toEqual([
      'Model',
      'Processing started',
      'Processing finished',
      'Duration',
      'Resolution',
      'Cloud coverage',
    ])
  })

  it('formats the exact bounds, the CRS and the footprint area', () => {
    const facts = extentFacts({
      bounds: { north: 13.2402, south: -13.1998, east: 80.3957, west: -80.3403 },
      crs: null,
    })
    expect(facts.edges.map((e) => e.value)).toEqual([
      '13.24020° N',
      '13.19980° S',
      '80.39570° E',
      '80.34030° W',
    ])
    expect(facts.crs).toBe('Not available')
    expect(extentFacts(hero).crs).toBe('EPSG:32644')
    expect(extentFacts(hero).footprintArea).toMatch(/km²$/)
    expect(extentFacts({ bounds: null, crs: null }).footprintArea).toBe(EMPTY_VALUE)
  })
})

describe('detectionFromParam', () => {
  const detections = hero.detections
  const first = detections[0]?.id ?? ''

  it('accepts a known id, trimmed', () => {
    expect(detectionFromParam(detections, first)).toBe(first)
    expect(detectionFromParam(detections, ` ${first} `)).toBe(first)
  })

  it('ignores missing, empty and unknown ids', () => {
    expect(detectionFromParam(detections, null)).toBeNull()
    expect(detectionFromParam(detections, '')).toBeNull()
    expect(detectionFromParam(detections, 'd-does-not-exist')).toBeNull()
    expect(detectionFromParam([], first)).toBeNull()
  })
})

describe('evidenceSource', () => {
  it('uses the georeferenced preview when there is one', () => {
    const source = evidenceSource(
      { ...hero, previewUrl: 'https://example.test/preview.png' },
      { sampleData: false },
    )
    expect(source).toEqual({
      bounds: hero.bounds,
      previewUrl: 'https://example.test/preview.png',
      caption: null,
    })
  })

  it('falls back to basemap imagery on the same bounds, and says so', () => {
    const source = evidenceSource({ ...hero, previewUrl: '' }, { sampleData: true })
    expect(source.previewUrl).toBeNull()
    expect(source.bounds).toEqual(hero.bounds)
    expect(source.caption).toBe(
      'Showing basemap imagery. Source preview not available for sample data.',
    )
    expect(evidenceSource({ ...hero, previewUrl: ' ' }, { sampleData: false }).caption).toBe(
      'Showing basemap imagery. Source preview not available.',
    )
  })

  it('cannot place a preview without bounds, and fits to the detections instead', () => {
    const source = evidenceSource(
      { ...hero, bounds: null, previewUrl: 'https://example.test/preview.png' },
      { sampleData: false },
    )
    expect(source.previewUrl).toBeNull()
    expect(source.bounds).not.toBeNull()
    expect(source.caption).toMatch(/fitted to the detections/)
  })

  it('has nothing to show without bounds or detections', () => {
    expect(
      evidenceSource({ previewUrl: '', bounds: null, detections: [] }, { sampleData: true }),
    ).toEqual({
      bounds: null,
      previewUrl: null,
      caption: null,
    })
  })
})
