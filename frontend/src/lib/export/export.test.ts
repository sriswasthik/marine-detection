import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS } from '@/lib/filters'
import { exportBaseName, exportFileName } from './filename'
import { methodAndCaveats, reportAttributions } from './report'
import { describeFilters } from './scope'

describe('export file names', () => {
  const ennore = { region: 'Ennore coast, Bay of Bengal', capturedAt: '2026-10-03T05:06:41Z' }

  it('follows marine-debris_<region-slug>_<yyyy-mm-dd>.<ext>', () => {
    expect(exportFileName(ennore, 'geojson')).toBe(
      'marine-debris_ennore-coast-bay-of-bengal_2026-10-03.geojson',
    )
    expect(exportFileName(ennore, 'csv')).toBe(
      'marine-debris_ennore-coast-bay-of-bengal_2026-10-03.csv',
    )
  })

  it('adds a kind to tell files of the same type apart', () => {
    expect(exportFileName(ennore, 'geojson', 'hotspots')).toBe(
      'marine-debris_ennore-coast-bay-of-bengal_2026-10-03_hotspots.geojson',
    )
    expect(exportBaseName(ennore, 'report')).toBe(
      'marine-debris_ennore-coast-bay-of-bengal_2026-10-03_report',
    )
  })

  it('slugs accents, punctuation and empty names safely', () => {
    expect(
      exportFileName(
        { region: 'Baía de São José / Píer "4"', capturedAt: '2026-01-02T23:30:00Z' },
        'csv',
      ),
    ).toBe('marine-debris_baia-de-sao-jose-pier-4_2026-01-02.csv')
    expect(exportFileName({ region: '***', capturedAt: '2026-01-02T00:00:00Z' }, 'csv')).toBe(
      'marine-debris_observation_2026-01-02.csv',
    )
    expect(exportFileName({ region: 'X', capturedAt: 'not a date' }, 'csv')).toBe(
      'marine-debris_x_undated.csv',
    )
  })

  it('uses the capture day in UTC', () => {
    expect(exportFileName({ region: 'X', capturedAt: '2026-10-03T23:30:00-05:00' }, 'pdf')).toBe(
      'marine-debris_x_2026-10-04.pdf',
    )
  })
})

describe('describeFilters', () => {
  it('is null without active filters', () => {
    expect(describeFilters(DEFAULT_FILTERS)).toBeNull()
  })

  it('names each active filter in plain words', () => {
    expect(
      describeFilters({
        ...DEFAULT_FILTERS,
        minConfidence: 0.7,
        levels: ['high', 'critical'],
        source: 'satellite',
      }),
    ).toBe('Source satellite; confidence 70% or more; density High, Critical')
    expect(describeFilters({ ...DEFAULT_FILTERS, dateFrom: '2026-09-01' })).toBe(
      'Captured from 2026-09-01',
    )
  })
})

describe('report text', () => {
  it('names the model, explains confidence and the configurable thresholds', () => {
    const text = methodAndCaveats({ sampleData: false, cellSizeM: 250 }).join(' ')
    expect(text).toMatch(/U-Net marine debris segmentation 0\.1\.0/)
    expect(text).toMatch(/below 60% is low/)
    expect(text).toMatch(/250 m grid cell/)
    expect(text).toMatch(/configurable/)
    expect(text).not.toMatch(/Sample data/)
  })

  it('adds the sample-data disclaimer for sample data', () => {
    expect(methodAndCaveats({ sampleData: true, cellSizeM: 250 }).join(' ')).toMatch(
      /synthetic sample data/,
    )
  })

  it('credits the basemap, the training data, and real Sentinel-2 sources only', () => {
    const real = reportAttributions({
      basemap: 'satellite',
      source: 'satellite',
      sampleData: false,
      capturedAt: '2026-10-03T05:06:41Z',
    })
    expect(real.join(' ')).toMatch(/Esri World Imagery/)
    expect(real.join(' ')).toMatch(/Copernicus Sentinel-2 data 2026/)
    const sampleLight = reportAttributions({
      basemap: 'light',
      source: 'satellite',
      sampleData: true,
      capturedAt: '2026-10-03T05:06:41Z',
    })
    expect(sampleLight.join(' ')).toMatch(/OpenStreetMap contributors/)
    expect(sampleLight.join(' ')).not.toMatch(/data 2026/)
    const drone = reportAttributions({
      basemap: 'light',
      source: 'drone',
      sampleData: false,
      capturedAt: '2026-10-03T05:06:41Z',
    })
    expect(drone.join(' ')).not.toMatch(/data 2026/)
  })
})
