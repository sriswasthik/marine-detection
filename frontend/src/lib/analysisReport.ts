/**
 * The analysis report shown on Analyze after a run: the uploaded image's facts, the model run, the
 * debris figures and the QGIS hand-off. Every figure comes from the service's `geospatial`,
 * `processing` and `sceneContext` fields, or from the file header read in the browser before upload.
 */
import type {
  GeospatialSummary,
  LatLng,
  Observation,
  ProcessingInfo,
} from '@/features/observations/types'
import { utmZoneForEpsg } from './crs'
import type { FactRow } from './evidence'
import {
  EMPTY_VALUE,
  formatArea,
  formatCoveragePercent,
  formatDuration,
  formatInteger,
  formatLatitude,
  formatLongitude,
} from './format'

/** What is known about the image itself, from the service or from the header read before upload. */
export interface ImageFacts {
  bands: number | null
  width: number | null
  height: number | null
  /** "EPSG:32616", or null when the file has no coordinate system. */
  crs: string | null
  /** "WGS 84 / UTM zone 16N", when known. */
  crsName: string | null
  /** "10 m × 10 m", when known. */
  pixelSize: string | null
  dataType: string | null
}

function pixelSizeText(x: number, y: number, unit: string): string {
  const digits = unit === 'degree' ? 7 : 2
  const value = (n: number) => String(Number(n.toFixed(digits)))
  const suffix = unit === 'degree' ? '°' : ` ${unit}`
  return `${value(x)}${suffix} × ${value(y)}${suffix}`
}

export function imageFactsFromGeospatial(geo: GeospatialSummary): ImageFacts {
  return {
    bands: geo.bandCount,
    width: geo.width,
    height: geo.height,
    crs: geo.crs,
    crsName: geo.crsName,
    pixelSize: pixelSizeText(geo.pixelSizeX, geo.pixelSizeY, geo.pixelSizeUnit),
    dataType: geo.dataType,
  }
}

/** Name of a WGS84 UTM or geographic CRS from its EPSG code; null for anything else. */
export function crsNameForEpsg(epsg: number): string | null {
  if (epsg === 4326) return 'WGS 84'
  const utm = utmZoneForEpsg(epsg)
  return utm ? `WGS 84 / UTM zone ${utm.zone}${utm.hemisphere === 'north' ? 'N' : 'S'}` : null
}

/** Facts read from the GeoTIFF header in the browser, before upload. */
export function imageFactsFromHeader(header: {
  bands: number | null
  width: number | null
  height: number | null
  epsg: number | null
  resolutionM: number | null
}): ImageFacts {
  const resolution = header.resolutionM
  return {
    bands: header.bands,
    width: header.width,
    height: header.height,
    crs: header.epsg !== null ? `EPSG:${header.epsg}` : null,
    crsName: header.epsg !== null ? crsNameForEpsg(header.epsg) : null,
    pixelSize: resolution !== null ? `${String(Number(resolution.toFixed(2)))} m` : null,
    dataType: null,
  }
}

/** Bands, width, height, coordinate system and pixel size, as list rows. */
export function imageFactRows(facts: ImageFacts): FactRow[] {
  const rows: FactRow[] = [
    { label: 'Bands', value: formatInteger(facts.bands) },
    {
      label: 'Width',
      value: facts.width !== null ? `${formatInteger(facts.width)} px` : EMPTY_VALUE,
    },
    {
      label: 'Height',
      value: facts.height !== null ? `${formatInteger(facts.height)} px` : EMPTY_VALUE,
    },
    {
      label: 'Coordinate reference system',
      value: facts.crs
        ? facts.crsName && facts.crsName !== facts.crs
          ? `${facts.crs} · ${facts.crsName}`
          : facts.crs
        : 'None found',
      mono: facts.crs !== null,
    },
  ]
  if (facts.pixelSize) rows.push({ label: 'Pixel size', value: facts.pixelSize })
  if (facts.dataType) rows.push({ label: 'Data type', value: facts.dataType, mono: true })
  return rows
}

// ---------------------------------------------------------------------------
// Model run
// ---------------------------------------------------------------------------

const STAGE_LABELS: Readonly<Record<string, string>> = {
  preprocessMs: 'Preprocess',
  detectMs: 'Model inference',
  mapMs: 'Mapping',
}

export interface ModelRunFacts {
  /** "U-Net marine debris segmentation, version f19c947d5a0a, on cpu". */
  model: string
  /** Total of the stage times, or the start-to-finish time when stages are not reported. */
  totalMs: number | null
  stages: { label: string; ms: number }[]
}

export function modelRunFacts(processing: ProcessingInfo): ModelRunFacts {
  const device = processing.device ? `, on ${processing.device}` : ''
  const stages = Object.entries(processing.stagesMs ?? {}).map(([key, ms]) => ({
    label: STAGE_LABELS[key] ?? key,
    ms,
  }))
  const span = Date.parse(processing.finishedAt) - Date.parse(processing.startedAt)
  const totalMs =
    stages.length > 0
      ? stages.reduce((sum, stage) => sum + stage.ms, 0)
      : Number.isFinite(span) && span >= 0
        ? span
        : null
  return {
    model: `${processing.modelName}, version ${processing.modelVersion}${device}`,
    totalMs,
    stages,
  }
}

/** "Preprocess 165 ms · Model inference 252 ms · Mapping 167 ms". */
export function stageTimesText(stages: ModelRunFacts['stages']): string {
  return stages.map((stage) => `${stage.label} ${formatDuration(stage.ms)}`).join(' · ')
}

// ---------------------------------------------------------------------------
// Geospatial figures
// ---------------------------------------------------------------------------

/** The point the centroid rows report: the debris centroid, or the image centre without debris. */
export function reportCentroid(geo: GeospatialSummary): { point: LatLng; ofDebris: boolean } {
  return geo.debrisCentroid
    ? { point: geo.debrisCentroid, ofDebris: true }
    : { point: geo.sceneCentre, ofDebris: false }
}

/** Pixel area, scene area, debris area and the centroid, as list rows. */
export function geospatialDetailRows(geo: GeospatialSummary): FactRow[] {
  const { point, ofDebris } = reportCentroid(geo)
  const centroidOf = ofDebris ? 'debris' : 'image centre, no debris'
  return [
    { label: 'Pixel area', value: formatArea(geo.pixelAreaM2, { unit: 'm2' }) },
    {
      label: 'Total scene area',
      value: `${formatArea(geo.sceneAreaM2)} (${formatInteger(geo.totalPixels)} px)`,
    },
    {
      label: 'Debris area',
      value: `${formatArea(geo.debrisAreaM2)} (${formatInteger(geo.debrisPixels)} px)`,
    },
    {
      label: `Centroid latitude (${centroidOf})`,
      value: formatLatitude(point.lat, { format: 'decimal', digits: 6 }),
      mono: true,
    },
    {
      label: `Centroid longitude (${centroidOf})`,
      value: formatLongitude(point.lng, { format: 'decimal', digits: 6 }),
      mono: true,
    },
  ]
}

/** "1.83 ha" as figure "1.83" and unit "ha"; "0.28%" keeps its sign on the figure. */
export function measureParts(text: string): { figure: string; unit: string } {
  const space = text.lastIndexOf(' ')
  return space > 0
    ? { figure: text.slice(0, space), unit: text.slice(space + 1) }
    : { figure: text, unit: '' }
}

/** The four headline figures: debris pixels, debris area, coverage of the scene, scene area. */
export function debrisFigures(geo: GeospatialSummary) {
  return {
    debrisPixels: geo.debrisPixels,
    debrisArea: formatArea(geo.debrisAreaM2),
    coverage: formatCoveragePercent(geo.debrisCoveragePercent),
    sceneArea: formatArea(geo.sceneAreaM2),
  }
}

// ---------------------------------------------------------------------------
// Segmentation mask and QGIS
// ---------------------------------------------------------------------------

/**
 * The class colours of the QGIS style (public/qgis/qgis_color_mask_mapping.qml, a copy of
 * utils/qgis_color_mask_mapping.qml). segmentation.png is drawn in them, so the legend matches the
 * mask here and in QGIS. A test keeps them equal to the file.
 */
export const QGIS_CLASS_STYLE: readonly { id: number; name: string; color: string }[] = [
  { id: 1, name: 'Marine Debris', color: '#ff0000' },
  { id: 2, name: 'Dense Sargassum', color: '#008000' },
  { id: 3, name: 'Sparse Sargassum', color: '#32cd32' },
  { id: 4, name: 'Natural Organic Material', color: '#b22222' },
  { id: 5, name: 'Ship', color: '#ffa500' },
  { id: 6, name: 'Clouds', color: '#c0c0c0' },
  { id: 7, name: 'Marine Water', color: '#000080' },
  { id: 8, name: 'Sediment-Laden Water', color: '#ffd700' },
  { id: 9, name: 'Foam', color: '#800080' },
  { id: 10, name: 'Turbid Water', color: '#bdb76b' },
  { id: 11, name: 'Shallow Water', color: '#00ced1' },
]

export const QGIS_STYLE_FILE_NAME = 'qgis_color_mask_mapping.qml'

export function qgisStyleUrl(baseUrl: string = import.meta.env.BASE_URL): string {
  return `${baseUrl}qgis/${QGIS_STYLE_FILE_NAME}`
}

export interface LegendEntry {
  id: number
  name: string
  color: string
  pixels: number
  /** Share of the valid pixels, percent. */
  percent: number
}

/**
 * Every model class with its QGIS colour and its pixel count in this image, largest first. Classes
 * the model did not predict are left out. Empty when the service sent no class counts.
 */
export function segmentationLegend(observation: Pick<Observation, 'sceneContext'>): LegendEntry[] {
  const context = observation.sceneContext
  if (!context) return []
  return QGIS_CLASS_STYLE.map((entry) => {
    const pixels = context.classPixelCounts[String(entry.id)] ?? 0
    return {
      ...entry,
      pixels,
      percent: context.validPixels > 0 ? (100 * pixels) / context.validPixels : 0,
    }
  })
    .filter((entry) => entry.pixels > 0)
    .sort((a, b) => b.pixels - a.pixels || a.id - b.id)
}

/** "S2_9-10-17_16PEC_0_segmentation.tif": the name the service also gives the download. */
export function segmentationFileName(observation: Pick<Observation, 'id'>): string {
  return `${observation.id}_segmentation.tif`
}
