import { describe, expect, it } from 'vitest'
import {
  getSampleObservation,
  getSampleObservations,
  SAMPLE_IDS,
} from '@/features/observations/mock/samples'
import type { Observation, ObservationSummary } from '@/features/observations/types'
import { analyzeObservation } from './analysis'
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  filterDetections,
  filterObservations,
  hasActiveFilters,
  observationMatchesFilters,
  regionGroup,
  regionGroups,
  type MapFilters,
} from './filters'

const samples = getSampleObservations()
const summaries: ObservationSummary[] = samples.map(({ detections, ...rest }) => ({
  ...rest,
  detectionCount: detections.length,
}))

function sample(id: string): Observation {
  const found = getSampleObservation(id)
  if (!found) throw new Error(`Missing ${id}`)
  return found
}

const hero = sample(SAMPLE_IDS.ennore)
const filters = (patch: Partial<MapFilters>): MapFilters => ({ ...DEFAULT_FILTERS, ...patch })
const ids = (list: readonly { id: string }[]) => list.map((o) => o.id)

describe('regions', () => {
  it('groups by the part after the last comma', () => {
    expect(regionGroup('Ennore coast, Bay of Bengal')).toBe('Bay of Bengal')
    expect(regionGroup('Gulf of Mannar')).toBe('Gulf of Mannar')
    expect(regionGroup('  Mahim Bay ,  Mumbai ')).toBe('Mumbai')
    expect(regionGroup('Trailing comma,')).toBe('Trailing comma')
  })

  it('lists distinct groups alphabetically', () => {
    expect(regionGroups(summaries)).toEqual(['Bay of Bengal', 'Gulf of Mannar', 'Kochi', 'Mumbai'])
  })
})

describe('filterObservations', () => {
  it('returns everything with default filters', () => {
    expect(filterObservations(summaries, DEFAULT_FILTERS)).toHaveLength(6)
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('filters by source', () => {
    expect(filterObservations(summaries, filters({ source: 'satellite' }))).toHaveLength(6)
    expect(filterObservations(summaries, filters({ source: 'drone' }))).toEqual([])
    const drone = summaries.map((s) => ({ ...s, source: 'drone' as const }))
    expect(filterObservations(drone, filters({ source: 'drone' }))).toHaveLength(6)
  })

  it('filters by an inclusive capture date range', () => {
    const range = filters({ dateFrom: '2026-09-18', dateTo: '2026-09-29' })
    expect(ids(filterObservations(summaries, range)).sort()).toEqual(
      [SAMPLE_IDS.mahim, SAMPLE_IDS.vembanad, SAMPLE_IDS.mannar].sort(),
    )
    expect(ids(filterObservations(summaries, filters({ dateFrom: '2026-10-03' })))).toEqual([
      SAMPLE_IDS.ennore,
    ])
    expect(ids(filterObservations(summaries, filters({ dateTo: '2026-08-31' })))).toEqual([
      SAMPLE_IDS.sundarbans,
    ])
  })

  it('filters by region group', () => {
    const bay = filterObservations(summaries, filters({ region: 'Bay of Bengal' }))
    expect(ids(bay).sort()).toEqual(
      [SAMPLE_IDS.ennore, SAMPLE_IDS.visakhapatnam, SAMPLE_IDS.sundarbans].sort(),
    )
  })

  it('combines dimensions and can return nothing', () => {
    expect(
      filterObservations(summaries, filters({ source: 'drone', region: 'Bay of Bengal' })),
    ).toEqual([])
    expect(filterObservations(summaries, filters({ dateFrom: '2030-01-01' }))).toEqual([])
    expect(filterObservations([], DEFAULT_FILTERS)).toEqual([])
  })
})

describe('filterDetections', () => {
  it('keeps detections at or above the minimum confidence', () => {
    const kept = filterDetections(hero.detections, filters({ minConfidence: 0.8 }))
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(hero.detections.length)
    expect(kept.every((d) => d.confidence >= 0.8)).toBe(true)
  })

  it('keeps only the chosen density levels', () => {
    const kept = filterDetections(hero.detections, filters({ levels: ['critical'] }))
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.every((d) => d.densityLevel === 'critical')).toBe(true)
    expect(filterDetections(hero.detections, filters({ levels: [] }))).toEqual([])
  })

  it('combines confidence and level', () => {
    const kept = filterDetections(
      hero.detections,
      filters({ minConfidence: 0.7, levels: ['high', 'critical'] }),
    )
    expect(
      kept.every((d) => d.confidence >= 0.7 && ['high', 'critical'].includes(d.densityLevel)),
    ).toBe(true)
    expect(filterDetections(hero.detections, filters({ minConfidence: 1 }))).toEqual([])
  })
})

describe('applyFilters', () => {
  it('returns the same observation untouched when nothing is filtered', () => {
    const result = applyFilters(hero, DEFAULT_FILTERS)
    expect(result.observation).toBe(hero)
    expect(result).toMatchObject({
      matches: true,
      shownCount: hero.detections.length,
      totalCount: hero.detections.length,
    })
  })

  it('hides every detection when the observation is outside the filters', () => {
    const result = applyFilters(hero, filters({ source: 'drone' }))
    expect(result.matches).toBe(false)
    expect(result.shownCount).toBe(0)
    expect(result.totalCount).toBe(hero.detections.length)
    expect(observationMatchesFilters(hero, filters({ source: 'drone' }))).toBe(false)
  })

  it('handles the zero-detection observation', () => {
    const result = applyFilters(sample(SAMPLE_IDS.mannar), filters({ minConfidence: 0.9 }))
    expect(result).toMatchObject({ matches: true, shownCount: 0, totalCount: 0 })
  })

  it('counts active filter dimensions', () => {
    expect(
      activeFilterCount(filters({ source: 'drone', dateFrom: '2026-01-01', dateTo: '2026-02-01' })),
    ).toBe(2)
    expect(
      activeFilterCount(filters({ minConfidence: 0.5, levels: ['low'], region: 'Kochi' })),
    ).toBe(3)
  })
})

describe('hotspot ranking after filtering', () => {
  it('recomputes hotspots from the filtered detections, ranked by priority score', () => {
    const full = analyzeObservation(hero)
    const filtered = applyFilters(hero, filters({ minConfidence: 0.75 }))
    const { hotspots } = analyzeObservation(filtered.observation)
    const shownIds = new Set(filtered.observation.detections.map((d) => d.id))

    expect(hotspots.map((h) => h.rank)).toEqual(hotspots.map((_, i) => i + 1))
    for (let i = 1; i < hotspots.length; i++) {
      expect(hotspots[i - 1]?.priorityScore ?? 0).toBeGreaterThanOrEqual(
        hotspots[i]?.priorityScore ?? 0,
      )
    }
    for (const hotspot of hotspots) {
      expect(hotspot.detectionIds.every((id) => shownIds.has(id))).toBe(true)
    }
    const totalBefore = full.hotspots.reduce((s, h) => s + h.totalAreaM2, 0)
    const totalAfter = hotspots.reduce((s, h) => s + h.totalAreaM2, 0)
    expect(totalAfter).toBeLessThan(totalBefore)
  })

  it('recomputes hotspot levels from the detections that remain', () => {
    const lowOnly = applyFilters(hero, filters({ levels: ['low'] }))
    const { hotspots } = analyzeObservation(lowOnly.observation)
    expect(hotspots.every((h) => h.level !== 'critical')).toBe(true)
  })

  it('has no hotspots when everything is filtered out', () => {
    const none = applyFilters(hero, filters({ levels: [] }))
    expect(analyzeObservation(none.observation).hotspots).toEqual([])
  })
})
