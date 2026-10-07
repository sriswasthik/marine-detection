import { describe, expect, it } from 'vitest'
import { getSampleObservation, HERO_SAMPLE_ID } from '@/features/observations/mock/samples'
import { detectionGeoJsonText, detectionToFeature } from './geojson'
import { shortId } from './format'

describe('detection GeoJSON', () => {
  const observation = getSampleObservation(HERO_SAMPLE_ID)
  const detection = observation?.detections[0]
  if (!observation || !detection) throw new Error('Hero sample missing')

  it('builds a Feature with the geometry in [lng, lat] order and the key facts', () => {
    const feature = detectionToFeature(detection, observation)
    expect(feature.type).toBe('Feature')
    expect(feature.id).toBe(detection.id)
    expect(feature.geometry).toBe(detection.geometry)
    expect(feature.properties).toMatchObject({
      observationId: observation.id,
      areaM2: detection.areaM2,
      confidence: detection.confidence,
      densityLevel: detection.densityLevel,
      centroid: [detection.centroid.lng, detection.centroid.lat],
    })
  })

  it('serialises to parseable JSON', () => {
    const parsed = JSON.parse(detectionGeoJsonText(detection, observation)) as { type: string }
    expect(parsed.type).toBe('Feature')
  })

  it('shortens ids to their last segment', () => {
    expect(shortId('obs-ennore-20261003-d012')).toBe('d012')
    expect(shortId('plain')).toBe('plain')
    expect(shortId('')).toBe('')
  })
})
