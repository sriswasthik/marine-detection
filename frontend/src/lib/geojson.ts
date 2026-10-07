import type { Feature } from 'geojson'
import type { Detection, DetectionGeometry, Observation } from '@/features/observations/types'

export interface DetectionFeatureProperties {
  id: string
  observationId: string
  region: string
  source: Observation['source']
  capturedAt: string
  areaM2: number
  confidence: number
  densityLevel: Detection['densityLevel']
  sourcePixelCount: number
  centroid: [lng: number, lat: number]
}

/** One detection as a GeoJSON Feature ([lng, lat] coordinates), with its key facts. */
export function detectionToFeature(
  detection: Detection,
  observation: Pick<Observation, 'id' | 'region' | 'source' | 'capturedAt'>,
): Feature<DetectionGeometry, DetectionFeatureProperties> {
  return {
    type: 'Feature',
    id: detection.id,
    geometry: detection.geometry,
    properties: {
      id: detection.id,
      observationId: observation.id,
      region: observation.region,
      source: observation.source,
      capturedAt: observation.capturedAt,
      areaM2: detection.areaM2,
      confidence: detection.confidence,
      densityLevel: detection.densityLevel,
      sourcePixelCount: detection.sourcePixelCount,
      centroid: [detection.centroid.lng, detection.centroid.lat],
    },
  }
}

export function detectionGeoJsonText(
  detection: Detection,
  observation: Pick<Observation, 'id' | 'region' | 'source' | 'capturedAt'>,
): string {
  return JSON.stringify(detectionToFeature(detection, observation), null, 2)
}
