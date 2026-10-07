import { describe, expect, it } from 'vitest'
import { activeFilterCount, DEFAULT_FILTERS } from './filters'
import { DEFAULT_VISIBLE_LAYERS } from './map/layers'
import {
  baselineFilters,
  parseMapSearch,
  serializeMapSearch,
  type MapDefaults,
} from './mapUrlState'

const settingsDefaults: MapDefaults = {
  basemap: 'satellite',
  minConfidence: 0.6,
  layers: { ...DEFAULT_VISIBLE_LAYERS, density: true },
}

describe('map defaults from Settings', () => {
  it('fill in whatever a link leaves out', () => {
    const state = parseMapSearch('', settingsDefaults)
    expect(state.basemap).toBe('satellite')
    expect(state.filters.minConfidence).toBe(0.6)
    expect(state.layers.density).toBe(true)
  })

  it('never override what a link says', () => {
    const state = parseMapSearch('bm=light&conf=0&layers=detections', settingsDefaults)
    expect(state.basemap).toBe('light')
    expect(state.filters.minConfidence).toBe(0)
    expect(state.layers).toEqual({
      detections: true,
      density: false,
      hotspots: false,
      footprint: false,
    })
  })

  it('keep the default view out of the URL, and write differences', () => {
    const state = parseMapSearch('', settingsDefaults)
    expect(serializeMapSearch(state, settingsDefaults).toString()).toBe('')
    const everything = { ...state, filters: { ...state.filters, minConfidence: 0 } }
    expect(serializeMapSearch(everything, settingsDefaults).toString()).toBe('conf=0')
  })

  it('make Reset return to the default minimum confidence, not to zero', () => {
    const baseline = baselineFilters(settingsDefaults)
    expect(baseline).toEqual({ ...DEFAULT_FILTERS, minConfidence: 0.6 })
    expect(activeFilterCount(baseline, baseline)).toBe(0)
    expect(activeFilterCount(DEFAULT_FILTERS, baseline)).toBe(1)
  })
})
