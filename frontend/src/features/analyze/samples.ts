import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Observation, ObservationSource } from '@/features/observations/types'
import { toDateTimeLocalValue } from '@/lib/datetime'
import { slugify } from '@/lib/format'
import { degreesToMeters } from '@/lib/geo'
import { boundsToInput, type BoundsInput, type FileFacts, type FileInspection } from './validate'

/** Sample scenes offered on the Analyze page: the hero, the drone survey and a clear result. */
export const SAMPLE_SCENE_IDS = [SAMPLE_IDS.ennore, SAMPLE_IDS.mahim, SAMPLE_IDS.mannar] as const

export interface SampleSelection {
  sampleId: string
  file: File
  facts: FileFacts
  inspection: FileInspection
  source: ObservationSource
  region: string
  capturedAt: string
  bounds: BoundsInput
}

/**
 * A sample observation as if its image had been chosen: a tiny stand-in file whose name tells
 * the mock backend which sample to return, plus everything a GeoTIFF header would have given.
 * No real file and no network needed.
 */
export function sampleSelection(observation: Observation): SampleSelection {
  const name = `${slugify(observation.name ?? observation.region)}-sample.tif`
  const file = new File([new Uint8Array([0x49, 0x49, 0x2a, 0x00])], name, { type: 'image/tiff' })
  const resolution = observation.resolutionM ?? 10
  const bounds = observation.bounds
  const size = bounds
    ? degreesToMeters(
        { dLng: bounds.east - bounds.west, dLat: bounds.north - bounds.south },
        (bounds.north + bounds.south) / 2,
      )
    : null
  const epsg = observation.crs?.startsWith('EPSG:') ? Number(observation.crs.slice(5)) : null
  return {
    sampleId: observation.id,
    file,
    facts: { name: file.name, size: file.size, type: file.type },
    inspection: {
      kind: 'geotiff',
      width: size ? Math.round(size.dxM / resolution) : null,
      height: size ? Math.round(size.dyM / resolution) : null,
      georeferenced: bounds !== null,
      embeddedBounds: bounds,
      epsg,
      resolutionM: resolution,
      previewUrl: null,
      readError: null,
    },
    source: observation.source,
    region: observation.region,
    capturedAt: toDateTimeLocalValue(new Date(observation.capturedAt)),
    bounds: bounds ? boundsToInput(bounds) : { north: '', south: '', east: '', west: '' },
  }
}

export function sampleScenes(): Observation[] {
  return SAMPLE_SCENE_IDS.map((id) => getSampleObservation(id)).filter(
    (o): o is Observation => o !== undefined,
  )
}
