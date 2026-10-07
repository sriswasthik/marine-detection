/**
 * Reads what can be read from a chosen file, in the browser: size, georeferencing and a small
 * preview. It never throws and never blocks the user; anything it cannot read is left unknown
 * and checked after upload instead.
 */
import { bboxToGeoBounds, resolutionMeters } from '@/lib/crs'
import { formatCoordinates } from '@/lib/format'
import { boundsCenter } from '@/lib/geo'
import { fileKind, type FileFacts, type FileInspection, type FileKind } from './validate'

const PREVIEW_MAX_PX = 640

export interface InspectionResult {
  inspection: FileInspection
  /** "Image centre near 13.22° N, 80.37° E", when the position is known. */
  regionHint: string | null
}

function emptyInspection(kind: FileKind, readError: string | null): FileInspection {
  return {
    kind,
    width: null,
    height: null,
    georeferenced: false,
    embeddedBounds: null,
    epsg: null,
    resolutionM: null,
    previewUrl: null,
    readError,
  }
}

function canvasFor(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.getContext('2d') ? canvas : null
}

function fitWithin(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function inspectBitmap(file: File, kind: FileKind): Promise<FileInspection> {
  if (typeof createImageBitmap !== 'function') {
    return emptyInspection(kind, 'This browser cannot read the image here.')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const size = fitWithin(bitmap.width, bitmap.height)
    const canvas = canvasFor(size.width, size.height)
    canvas?.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height)
    return {
      ...emptyInspection(kind, null),
      width: bitmap.width,
      height: bitmap.height,
      previewUrl: canvas ? canvas.toDataURL('image/jpeg', 0.85) : null,
    }
  } finally {
    bitmap.close()
  }
}

/** Contrast stretch between the 2nd and 98th percentiles, to 0..255. */
function stretch(band: ArrayLike<number>): Uint8ClampedArray {
  const values = Array.from(band)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const low = values[Math.floor(values.length * 0.02)] ?? 0
  const high = values[Math.floor(values.length * 0.98)] ?? 1
  const range = high - low || 1
  const out = new Uint8ClampedArray(band.length)
  for (let i = 0; i < band.length; i++) out[i] = (((band[i] ?? 0) - low) / range) * 255
  return out
}

async function inspectGeoTiff(file: File): Promise<FileInspection> {
  // Loaded only when a GeoTIFF is chosen, so it stays out of the main bundle.
  const { fromBlob } = await import('geotiff')
  const tiff = await fromBlob(file)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  const keys = image.getGeoKeys() ?? {}
  const rawEpsg: unknown = keys.ProjectedCSTypeGeoKey ?? keys.GeographicTypeGeoKey
  const epsg = typeof rawEpsg === 'number' && rawEpsg > 0 && rawEpsg < 32767 ? rawEpsg : null

  let bbox: number[] | null = null
  let resolution: number[] | null = null
  try {
    bbox = image.getBoundingBox()
    resolution = image.getResolution()
  } catch {
    // No geotransform: the image is not georeferenced.
  }
  const embeddedBounds = bbox ? bboxToGeoBounds(bbox, epsg) : null
  const centreLat = embeddedBounds ? (embeddedBounds.north + embeddedBounds.south) / 2 : 0

  const inspection: FileInspection = {
    kind: 'geotiff',
    width,
    height,
    georeferenced: bbox !== null && epsg !== null,
    embeddedBounds,
    epsg,
    resolutionM: resolution ? resolutionMeters(resolution, epsg, centreLat) : null,
    previewUrl: null,
    readError: null,
  }

  // The preview is a nice-to-have: any failure here keeps the facts read above.
  try {
    const size = fitWithin(width, height)
    const samples = image.getSamplesPerPixel() >= 3 ? [0, 1, 2] : [0]
    const rasters = await image.readRasters({
      width: size.width,
      height: size.height,
      samples,
      interleave: false,
      resampleMethod: 'nearest',
    })
    const bands = Array.from({ length: samples.length }, (_, i) => rasters[i])
      .filter(
        (band): band is NonNullable<typeof band> => band !== undefined && typeof band !== 'number',
      )
      .map((band) => stretch(band as ArrayLike<number>))
    const canvas = canvasFor(size.width, size.height)
    const context = canvas?.getContext('2d')
    if (canvas && context && bands.length > 0) {
      const pixels = context.createImageData(size.width, size.height)
      const [r, g = r, b = r] = bands
      for (let i = 0; i < size.width * size.height; i++) {
        pixels.data[i * 4] = r?.[i] ?? 0
        pixels.data[i * 4 + 1] = g?.[i] ?? 0
        pixels.data[i * 4 + 2] = b?.[i] ?? 0
        pixels.data[i * 4 + 3] = 255
      }
      context.putImageData(pixels, 0, 0)
      inspection.previewUrl = canvas.toDataURL('image/jpeg', 0.85)
    }
  } catch {
    inspection.previewUrl = null
  }
  return inspection
}

/** Reads a chosen file. Resolves for every input; unreadable files come back with a readError. */
export async function inspectFile(file: File): Promise<InspectionResult> {
  const facts: FileFacts = { name: file.name, size: file.size, type: file.type }
  const kind = fileKind(facts)
  if (!kind) return { inspection: emptyInspection('png', 'Unsupported format.'), regionHint: null }
  let inspection: FileInspection
  try {
    inspection = kind === 'geotiff' ? await inspectGeoTiff(file) : await inspectBitmap(file, kind)
  } catch {
    inspection = emptyInspection(
      kind,
      kind === 'geotiff'
        ? 'The GeoTIFF header could not be read here.'
        : 'The image could not be decoded here.',
    )
  }
  const regionHint = inspection.embeddedBounds
    ? `Image centre near ${formatCoordinates(boundsCenter(inspection.embeddedBounds), { digits: 2 })}`
    : null
  return { inspection, regionHint }
}
