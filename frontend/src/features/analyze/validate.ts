/**
 * Client-side checks for the Analyze form. Pure: no file reading here (see inspectFile.ts).
 * Every failure says what is wrong and how to fix it.
 */
import type { GeoBounds } from '@/features/observations/types'
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  MIN_IMAGE_PX,
  MODEL_INPUT,
  RESOLUTION_LIMITS_M,
} from '@/lib/config'
import { formatLength } from '@/lib/format'
import { degreesToMeters } from '@/lib/geo'

export type FileKind = 'geotiff'

/** What the browser tells us about a file before reading it. */
export interface FileFacts {
  name: string
  size: number
  type: string
}

/** What reading the file found. Any field can be unknown; reading never blocks the user. */
export interface FileInspection {
  kind: FileKind
  width: number | null
  height: number | null
  /** Bands per pixel; the model needs MODEL_INPUT.bands. */
  bands: number | null
  /** True when the file carries georeferencing, even in a system this app cannot convert. */
  georeferenced: boolean
  /** Bounds read from the file, when its coordinate system could be converted. */
  embeddedBounds: GeoBounds | null
  epsg: number | null
  resolutionM: number | null
  /** Downsampled preview as a data URL, or null ("Preview is generated after upload"). */
  previewUrl: string | null
  /** Plain-language reason reading stopped early, if it did. */
  readError: string | null
}

export interface ValidationIssue {
  code: 'UNSUPPORTED_FORMAT' | 'TOO_LARGE' | 'EMPTY_FILE' | 'TOO_SMALL'
  message: string
  fix: string
}

const KIND_BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  '.tif': 'geotiff',
  '.tiff': 'geotiff',
}

/** Photo formats people often try. They hold 3 colour bands, so they get their own message. */
const PHOTO_EXTENSIONS: readonly string[] = ['.png', '.jpg', '.jpeg']

const ACCEPTED_MIME_TYPES: readonly string[] = Object.keys(ACCEPTED_TYPES)

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

/** The kind of image, from the extension; null when unsupported or when the MIME type disagrees. */
export function fileKind(facts: Pick<FileFacts, 'name' | 'type'>): FileKind | null {
  const kind = KIND_BY_EXTENSION[fileExtension(facts.name)] ?? null
  if (!kind) return null
  // Browsers often report an empty type for TIFF files; an explicit, unrelated type is refused.
  if (facts.type && !ACCEPTED_MIME_TYPES.includes(facts.type)) return null
  return kind
}

const FORMAT_FIX = `Choose an ${MODEL_INPUT.bands}-band Sentinel-2 GeoTIFF (.tif), for example a MARIDA patch.`

const BANDS_FIX =
  'Stack Sentinel-2 bands B1 to B8A, B11 and B12, in that order, into one GeoTIFF and choose it again.'

/** Format and size checks that need nothing but the file name, type and size. */
export function validateFile(facts: FileFacts): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!fileKind(facts)) {
    const extension = fileExtension(facts.name)
    issues.push({
      code: 'UNSUPPORTED_FORMAT',
      message: PHOTO_EXTENSIONS.includes(extension)
        ? `${extension} images hold 3 colour bands. The model needs an ${MODEL_INPUT.bands}-band Sentinel-2 GeoTIFF.`
        : extension
          ? `${extension} files are not supported. Supported: ${ACCEPTED_EXTENSIONS.join(', ')}.`
          : `The file has no extension. Supported: ${ACCEPTED_EXTENSIONS.join(', ')}.`,
      fix: FORMAT_FIX,
    })
  }
  if (facts.size === 0) {
    issues.push({
      code: 'EMPTY_FILE',
      message: 'The file is empty.',
      fix: 'Choose the image again; the copy on this device may be incomplete.',
    })
  } else if (facts.size > MAX_UPLOAD_BYTES) {
    issues.push({
      code: 'TOO_LARGE',
      message: `The file is ${(facts.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_MB} MB.`,
      fix: 'Crop the image to the area of interest or export it with compression.',
    })
  }
  return issues
}

/** Minimum image size, inclusive. */
export function validateDimensions(width: number, height: number): ValidationIssue | null {
  if (width >= MIN_IMAGE_PX && height >= MIN_IMAGE_PX) return null
  return {
    code: 'TOO_SMALL',
    message: `The image is ${width} × ${height} pixels. It needs at least ${MIN_IMAGE_PX} × ${MIN_IMAGE_PX}.`,
    fix: 'Use a larger crop of the scene.',
  }
}

// ---------------------------------------------------------------------------
// Geographic bounds entered by hand
// ---------------------------------------------------------------------------

export interface BoundsInput {
  north: string
  south: string
  east: string
  west: string
}

export const EMPTY_BOUNDS_INPUT: BoundsInput = { north: '', south: '', east: '', west: '' }

export type BoundsErrors = Partial<Record<keyof BoundsInput, string>>

export interface BoundsValidation {
  /** The bounds when every field is valid, otherwise null. */
  bounds: GeoBounds | null
  errors: BoundsErrors
  /** True when no field has been filled in. */
  empty: boolean
}

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

function parseCoordinate(
  value: string,
  name: string,
  limit: 90 | 180,
): { value: number | null; error?: string } {
  const trimmed = value.trim()
  if (trimmed === '') return { value: null, error: `Enter the ${name}.` }
  if (!NUMBER.test(trimmed)) {
    return { value: null, error: 'Use decimal degrees, for example 13.2215 or -80.36.' }
  }
  const number = Number(trimmed)
  if (number < -limit || number > limit) {
    return {
      value: null,
      error: `${limit === 90 ? 'Latitude' : 'Longitude'} must be between -${limit} and ${limit}.`,
    }
  }
  return { value: number }
}

/**
 * Validates north, south, east and west in decimal degrees: latitudes within -90..90,
 * longitudes within -180..180, north above south and east of west. Scenes crossing the
 * antimeridian are not supported.
 */
export function validateBounds(input: BoundsInput): BoundsValidation {
  const empty = Object.values(input).every((v) => v.trim() === '')
  const north = parseCoordinate(input.north, 'north latitude', 90)
  const south = parseCoordinate(input.south, 'south latitude', 90)
  const east = parseCoordinate(input.east, 'east longitude', 180)
  const west = parseCoordinate(input.west, 'west longitude', 180)
  const errors: BoundsErrors = {}
  if (north.error) errors.north = north.error
  if (south.error) errors.south = south.error
  if (east.error) errors.east = east.error
  if (west.error) errors.west = west.error
  if (north.value !== null && south.value !== null && north.value <= south.value) {
    errors.north = 'North must be greater than south.'
  }
  if (east.value !== null && west.value !== null && east.value <= west.value) {
    errors.east = 'East must be greater than west.'
  }
  const valid =
    Object.keys(errors).length === 0 &&
    north.value !== null &&
    south.value !== null &&
    east.value !== null &&
    west.value !== null
  return {
    bounds: valid
      ? {
          north: north.value ?? 0,
          south: south.value ?? 0,
          east: east.value ?? 0,
          west: west.value ?? 0,
        }
      : null,
    errors,
    empty,
  }
}

export function boundsToInput(bounds: GeoBounds): BoundsInput {
  const fixed = (value: number) => String(Number(value.toFixed(6)))
  return {
    north: fixed(bounds.north),
    south: fixed(bounds.south),
    east: fixed(bounds.east),
    west: fixed(bounds.west),
  }
}

/** Ground resolution implied by bounds and pixel width, meters per pixel. */
export function estimateResolutionM(bounds: GeoBounds, widthPx: number): number | null {
  if (!(widthPx > 0)) return null
  const { dxM } = degreesToMeters(
    { dLng: bounds.east - bounds.west, dLat: 0 },
    (bounds.north + bounds.south) / 2,
  )
  return dxM / widthPx
}

// ---------------------------------------------------------------------------
// Quality checks
// ---------------------------------------------------------------------------

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'pending'
export type QualityCheckId =
  'format' | 'bands' | 'dimensions' | 'georeferencing' | 'cloud' | 'resolution'

export interface QualityCheck {
  id: QualityCheckId
  label: string
  status: CheckStatus
  detail: string
  /** What to do about a warning or failure. */
  fix?: string
}

export interface QualityInput {
  facts: FileFacts
  inspection: FileInspection | null
  inspecting: boolean
  bounds: BoundsValidation
}

function formatCheck(facts: FileFacts): QualityCheck {
  const issues = validateFile(facts)
  const [first] = issues
  if (first) {
    return {
      id: 'format',
      label: 'Format',
      status: 'fail',
      detail: issues.map((i) => i.message).join(' '),
      fix: first.fix,
    }
  }
  return { id: 'format', label: 'Format', status: 'pass', detail: 'GeoTIFF' }
}

/** The model reads exactly MODEL_INPUT.bands bands; anything else is refused before upload. */
function bandsCheck({ inspection, inspecting }: QualityInput): QualityCheck {
  const base = { id: 'bands' as const, label: 'Bands' }
  const expected = MODEL_INPUT.bands
  if (inspection?.bands) {
    if (inspection.bands === expected) {
      return { ...base, status: 'pass', detail: `${expected} bands, Sentinel-2 order assumed` }
    }
    return {
      ...base,
      status: 'fail',
      detail: `The image has ${inspection.bands} ${inspection.bands === 1 ? 'band' : 'bands'}. The model needs ${expected}.`,
      fix: BANDS_FIX,
    }
  }
  if (inspecting) return { ...base, status: 'pending', detail: 'Reading the file' }
  return {
    ...base,
    status: 'warning',
    detail: 'The band count could not be read here. It is checked after upload.',
  }
}

function dimensionsCheck({ inspection, inspecting }: QualityInput): QualityCheck {
  const base = { id: 'dimensions' as const, label: 'Dimensions' }
  if (inspection?.width && inspection.height) {
    const issue = validateDimensions(inspection.width, inspection.height)
    return issue
      ? { ...base, status: 'fail', detail: issue.message, fix: issue.fix }
      : { ...base, status: 'pass', detail: `${inspection.width} × ${inspection.height} pixels` }
  }
  if (inspecting) return { ...base, status: 'pending', detail: 'Reading the file' }
  return {
    ...base,
    status: 'warning',
    detail: 'The size could not be read here. It is checked after upload.',
  }
}

function georeferencingCheck({ inspection, bounds }: QualityInput): QualityCheck {
  const base = { id: 'georeferencing' as const, label: 'Georeferencing' }
  if (inspection?.embeddedBounds && bounds.bounds) {
    return {
      ...base,
      status: 'pass',
      detail: inspection.epsg
        ? `Read from the file (EPSG:${inspection.epsg})`
        : 'Read from the file',
    }
  }
  if (bounds.bounds) return { ...base, status: 'pass', detail: 'Bounds entered by hand' }
  if (inspection?.georeferenced) {
    return {
      ...base,
      status: 'fail',
      detail: inspection.epsg
        ? `The file uses EPSG:${inspection.epsg}, which cannot be converted here.`
        : 'The file has georeferencing in a system that cannot be converted here.',
      fix: 'Enter the north, south, east and west bounds below.',
    }
  }
  return {
    ...base,
    status: 'fail',
    detail: 'No geographic position.',
    fix: 'Enter the north, south, east and west bounds below.',
  }
}

function resolutionCheck({ inspection, bounds }: QualityInput): QualityCheck {
  const base = { id: 'resolution' as const, label: 'Resolution' }
  const estimated =
    inspection?.resolutionM ??
    (bounds.bounds && inspection?.width
      ? estimateResolutionM(bounds.bounds, inspection.width)
      : null)
  if (estimated === null) {
    return { ...base, status: 'pending', detail: 'Read from the image during preprocessing' }
  }
  const label = `${formatLength(estimated)} per pixel${inspection?.resolutionM ? '' : ', estimated from the bounds'}`
  if (estimated <= RESOLUTION_LIMITS_M.good) return { ...base, status: 'pass', detail: label }
  if (estimated <= RESOLUTION_LIMITS_M.usable) {
    return {
      ...base,
      status: 'warning',
      detail: label,
      fix: 'Small debris may be missed at this resolution. Use finer imagery if you have it.',
    }
  }
  return {
    ...base,
    status: 'fail',
    detail: `${label}. Floating debris is not visible this coarse.`,
    fix: `Use imagery of ${formatLength(RESOLUTION_LIMITS_M.usable)} per pixel or finer.`,
  }
}

/** The checklist shown next to the preview: Format, Bands, Dimensions, Georeferencing, Cloud cover, Resolution. */
export function qualityChecks(input: QualityInput): QualityCheck[] {
  const format = formatCheck(input.facts)
  // A file the model cannot read is not checked further: the other results would only add noise.
  if (!fileKind(input.facts)) return [format]
  return [
    format,
    bandsCheck(input),
    dimensionsCheck(input),
    georeferencingCheck(input),
    {
      id: 'cloud',
      label: 'Cloud cover',
      status: 'pending',
      detail: 'Estimated during preprocessing',
    },
    resolutionCheck(input),
  ]
}

export interface Readiness {
  ready: boolean
  /** Why "Run detection" is disabled, shown next to the button. */
  reason: string | null
}

/** Whether detection can run, and if not, the first thing to fix. */
export function runReadiness(input: {
  hasFile: boolean
  inspecting: boolean
  checks: readonly QualityCheck[]
  capturedAtIso: string | null
  /** False while the device is offline. The form can still be filled in. */
  online?: boolean
}): Readiness {
  const block = (reason: string): Readiness => ({ ready: false, reason })
  if (!input.hasFile) return block('Choose an image or a sample scene to start.')
  if (input.inspecting) return block('Reading the file. This takes a moment.')
  const failed = input.checks.find((c) => c.status === 'fail')
  if (failed) return block(`${failed.label}: ${failed.fix ?? failed.detail}`)
  if (!input.capturedAtIso) return block('Enter when the image was captured.')
  if (input.online === false) return block("You're offline. Reconnect to run detection.")
  return { ready: true, reason: null }
}
