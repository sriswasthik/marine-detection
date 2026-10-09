import { describe, expect, it } from 'vitest'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Observation } from '@/features/observations/types'
import { analyzeObservation } from './analysis'
import { formatArea, formatConfidence, formatCoveragePercent } from './format'
import { fleetSummary, observationKpis } from './kpis'

function sample(id: string): Observation {
  const found = getSampleObservation(id)
  if (!found) throw new Error(`Missing ${id}`)
  return found
}

const byId = (kpis: ReturnType<typeof observationKpis>) =>
  Object.fromEntries(kpis.map((k) => [k.id, k]))

describe('observationKpis', () => {
  it('formats the hero observation through the real formatters', () => {
    const hero = sample(SAMPLE_IDS.ennore)
    const { hotspots } = analyzeObservation(hero)
    const kpis = byId(observationKpis(hero, hotspots))
    expect(kpis.debrisArea?.value).toBe(formatArea(hero.debrisAreaM2))
    expect(kpis.debrisArea?.footnote).toBe(`${hero.detections.length} detections`)
    expect(kpis.coverage?.value).toBe(formatCoveragePercent(hero.coveragePercent))
    expect(kpis.coverage?.footnote).toBe(`of ${formatArea(hero.waterAreaM2)} water`)
    expect(kpis.hotspots?.value).toBe('3')
    expect(kpis.hotspots?.footnote).toBe('Highest level: Critical')
    expect(kpis.confidence?.value).toBe(formatConfidence(hero.averageConfidence))
  })

  it('explains coverage exactly as the formula reads', () => {
    const hero = sample(SAMPLE_IDS.ennore)
    const kpis = byId(observationKpis(hero, []))
    expect(kpis.coverage?.hint).toBe(
      'Coverage = detected debris area / water area in the analysed footprint.',
    )
  })

  it('shows zeros and a dash, never NaN, for a no-debris observation', () => {
    const mannar = sample(SAMPLE_IDS.mannar)
    const kpis = observationKpis(mannar, [])
    const text = kpis.map((k) => `${k.value} ${k.footnote}`).join(' ')
    expect(text).not.toMatch(/NaN|undefined|Infinity/)
    const map = byId(kpis)
    expect(map.debrisArea?.value).toBe('0 m²')
    expect(map.coverage?.value).toBe('0%')
    expect(map.hotspots?.value).toBe('0')
    expect(map.hotspots?.footnote).toBe('None stands out')
    expect(map.confidence?.value).toBe('—')
    expect(map.confidence?.footnote).toBe('No detections to average')
  })

  it('counts low-confidence detections and uses singular wording', () => {
    const hero = sample(SAMPLE_IDS.ennore)
    const one = { ...hero, detections: hero.detections.slice(0, 1) }
    const map = byId(observationKpis(one, []))
    expect(map.debrisArea?.footnote).toBe('1 detection')
    expect(map.confidence?.footnote).toMatch(/^\d+ below 60%$/)
  })
})

describe('fleetSummary', () => {
  it('adds up every observation on record', () => {
    expect(
      fleetSummary([
        { detectionCount: 60, debrisAreaM2: 12_000 },
        { detectionCount: 0, debrisAreaM2: 0 },
        { detectionCount: 4, debrisAreaM2: 800 },
      ]),
    ).toEqual({ observations: 3, detections: 64, withDebris: 2, debrisAreaM2: 12_800 })
  })

  it('is all zeros for no observations, and ignores bad figures', () => {
    expect(fleetSummary([])).toEqual({
      observations: 0,
      detections: 0,
      withDebris: 0,
      debrisAreaM2: 0,
    })
    expect(fleetSummary([{ detectionCount: -2, debrisAreaM2: Number.NaN }]).debrisAreaM2).toBe(0)
  })
})
