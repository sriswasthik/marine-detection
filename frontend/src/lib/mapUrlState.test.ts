import { describe, expect, it } from 'vitest'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { DEFAULT_FILTERS } from './filters'
import { DEFAULT_VISIBLE_LAYERS } from './map/layers'
import {
  DEFAULT_MAP_URL_STATE,
  parseMapSearch,
  serializeMapSearch,
  type MapUrlState,
} from './mapUrlState'

const roundTrip = (state: MapUrlState) => parseMapSearch(serializeMapSearch(state))

describe('map URL state', () => {
  it('serialises the default view to an empty query string', () => {
    expect(serializeMapSearch(DEFAULT_MAP_URL_STATE).toString()).toBe('')
    expect(parseMapSearch('')).toEqual(DEFAULT_MAP_URL_STATE)
  })

  it('round trips a fully customised view', () => {
    const state: MapUrlState = {
      filters: {
        source: 'satellite',
        dateFrom: '2026-09-01',
        dateTo: '2026-10-05',
        minConfidence: 0.65,
        levels: ['high', 'critical'],
        region: 'Bay of Bengal',
      },
      detectionId: 'obs-ennore-20261003-d012',
      hotspotId: null,
      basemap: 'satellite',
      layers: { detections: true, density: true, hotspots: false, footprint: true },
      fresh: true,
    }
    expect(roundTrip(state)).toEqual(state)
    const query = serializeMapSearch(state).toString()
    expect(query).toContain('conf=65')
    expect(query).toContain('lv=high%2Ccritical')
    expect(query).toContain('bm=satellite')
  })

  it('round trips empty level and layer selections', () => {
    const state: MapUrlState = {
      ...DEFAULT_MAP_URL_STATE,
      filters: { ...DEFAULT_FILTERS, levels: [] },
      layers: { detections: false, density: false, hotspots: false, footprint: false },
    }
    expect(serializeMapSearch(state).get('lv')).toBe('none')
    expect(serializeMapSearch(state).get('layers')).toBe('none')
    expect(roundTrip(state)).toEqual(state)
  })

  it('round trips a selected hotspot', () => {
    const state = { ...DEFAULT_MAP_URL_STATE, hotspotId: 'hotspot-2' }
    expect(roundTrip(state)).toEqual(state)
  })

  it('rounds confidence to whole percents', () => {
    const state = {
      ...DEFAULT_MAP_URL_STATE,
      filters: { ...DEFAULT_FILTERS, minConfidence: 0.678 },
    }
    expect(serializeMapSearch(state).get('conf')).toBe('68')
  })
})

describe('parsing garbage input', () => {
  it('falls back to defaults for every unreadable value', () => {
    const state = parseMapSearch(
      'src=boat&from=2026-13-45&to=yesterday&conf=abc&lv=purple,,&region=&d=%20&h=&bm=dark&layers=everything&fresh=yes',
    )
    expect(state).toEqual(DEFAULT_MAP_URL_STATE)
  })

  it('clamps confidence and ignores negative or fractional input', () => {
    expect(parseMapSearch('conf=250').filters.minConfidence).toBe(1)
    expect(parseMapSearch('conf=-20').filters.minConfidence).toBe(0)
    expect(parseMapSearch('conf=12.5').filters.minConfidence).toBe(0)
    expect(parseMapSearch('conf=0040').filters.minConfidence).toBe(0)
    expect(parseMapSearch('conf=040').filters.minConfidence).toBeCloseTo(0.4, 10)
  })

  it('keeps valid list items, in canonical order, without duplicates', () => {
    expect(parseMapSearch('lv=critical,banana,low,critical').filters.levels).toEqual([
      'low',
      'critical',
    ])
    expect(parseMapSearch('layers=density,density,nope').layers).toEqual({
      detections: false,
      density: true,
      hotspots: false,
      footprint: false,
    })
  })

  it('swaps a reversed date range and rejects impossible dates', () => {
    const state = parseMapSearch('from=2026-10-05&to=2026-09-01')
    expect(state.filters.dateFrom).toBe('2026-09-01')
    expect(state.filters.dateTo).toBe('2026-10-05')
    expect(parseMapSearch('from=2026-02-30').filters.dateFrom).toBeNull()
  })

  it('rejects overlong text values', () => {
    expect(parseMapSearch(`d=${'x'.repeat(500)}`).detectionId).toBeNull()
    expect(parseMapSearch('region=%20Kochi%20').filters.region).toBe('Kochi')
  })

  it('accepts a URLSearchParams instance and uses defaults for missing keys', () => {
    const state = parseMapSearch(new URLSearchParams({ src: 'drone' }))
    expect(state.filters.source).toBe('drone')
    expect(state.filters.levels).toEqual(DENSITY_LEVEL_IDS)
    expect(state.layers).toEqual(DEFAULT_VISIBLE_LAYERS)
  })
})
