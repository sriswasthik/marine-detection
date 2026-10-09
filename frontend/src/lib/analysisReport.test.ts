import { describe, expect, it } from 'vitest'
import type { GeospatialSummary, SceneContext } from '@/features/observations/types'
import qml from '../../public/qgis/qgis_color_mask_mapping.qml?raw'
import {
  crsNameForEpsg,
  debrisFigures,
  geospatialDetailRows,
  imageFactRows,
  imageFactsFromGeospatial,
  imageFactsFromHeader,
  measureParts,
  modelRunFacts,
  QGIS_CLASS_STYLE,
  qgisStyleUrl,
  reportCentroid,
  segmentationFileName,
  segmentationLegend,
  stageTimesText,
} from './analysisReport'

/** The figures backend/pipeline.py reports for sample_data/S2_9-10-17_16PEC_0.tif. */
const GEO: GeospatialSummary = {
  width: 256,
  height: 256,
  bandCount: 11,
  dataType: 'float32',
  crs: 'EPSG:32616',
  crsName: 'WGS 84 / UTM zone 16N',
  pixelSizeX: 10,
  pixelSizeY: 10,
  pixelSizeUnit: 'm',
  pixelAreaM2: 100,
  totalPixels: 65536,
  validPixels: 65536,
  sceneAreaM2: 6_553_600,
  debrisPixels: 183,
  debrisAreaM2: 18_300,
  debrisCoveragePercent: 0.279236,
  debrisCentroid: { lat: 15.8346111, lng: -86.8610612 },
  sceneCentre: { lat: 15.8314834, lng: -86.8621603 },
}

const valueOf = (rows: { label: string; value: string }[], label: string) =>
  rows.find((row) => row.label === label)?.value

describe('image facts', () => {
  it('reads bands, size, CRS and pixel size from the service', () => {
    const rows = imageFactRows(imageFactsFromGeospatial(GEO))
    expect(valueOf(rows, 'Bands')).toBe('11')
    expect(valueOf(rows, 'Width')).toBe('256 px')
    expect(valueOf(rows, 'Height')).toBe('256 px')
    expect(valueOf(rows, 'Coordinate reference system')).toBe('EPSG:32616 · WGS 84 / UTM zone 16N')
    expect(valueOf(rows, 'Pixel size')).toBe('10 m × 10 m')
    expect(valueOf(rows, 'Data type')).toBe('float32')
  })

  it('reads the same facts from a GeoTIFF header before upload', () => {
    const rows = imageFactRows(
      imageFactsFromHeader({ bands: 11, width: 256, height: 256, epsg: 32616, resolutionM: 10 }),
    )
    expect(valueOf(rows, 'Coordinate reference system')).toBe('EPSG:32616 · WGS 84 / UTM zone 16N')
    expect(valueOf(rows, 'Pixel size')).toBe('10 m')
    expect(valueOf(rows, 'Data type')).toBeUndefined()
  })

  it('says when there is no coordinate system, and dashes unknown sizes', () => {
    const rows = imageFactRows(
      imageFactsFromHeader({ bands: 3, width: null, height: null, epsg: null, resolutionM: null }),
    )
    expect(valueOf(rows, 'Coordinate reference system')).toBe('None found')
    expect(valueOf(rows, 'Width')).toBe('—')
    expect(valueOf(rows, 'Pixel size')).toBeUndefined()
  })

  it('names WGS84 UTM and geographic codes only', () => {
    expect(crsNameForEpsg(32616)).toBe('WGS 84 / UTM zone 16N')
    expect(crsNameForEpsg(32748)).toBe('WGS 84 / UTM zone 48S')
    expect(crsNameForEpsg(4326)).toBe('WGS 84')
    expect(crsNameForEpsg(3857)).toBeNull()
  })

  it('writes degree pixel sizes with a degree sign', () => {
    const facts = imageFactsFromGeospatial({
      ...GEO,
      pixelSizeX: 0.0000898,
      pixelSizeY: 0.0000898,
      pixelSizeUnit: 'degree',
    })
    expect(facts.pixelSize).toBe('0.0000898° × 0.0000898°')
  })
})

describe('model run', () => {
  it('names the model and totals the stage times', () => {
    const facts = modelRunFacts({
      startedAt: '2026-10-09T09:17:36.951Z',
      finishedAt: '2026-10-09T09:17:37.545Z',
      modelName: 'U-Net marine debris segmentation',
      modelVersion: 'f19c947d5a0a',
      device: 'cpu',
      stagesMs: { preprocessMs: 164.8, detectMs: 251.6, mapMs: 167 },
    })
    expect(facts.model).toBe('U-Net marine debris segmentation, version f19c947d5a0a, on cpu')
    expect(facts.totalMs).toBeCloseTo(583.4)
    expect(facts.stages.map((s) => s.label)).toEqual(['Preprocess', 'Model inference', 'Mapping'])
    expect(stageTimesText(facts.stages)).toMatch(/^Preprocess .+ · Model inference .+ · Mapping /)
  })

  it('falls back to start-to-finish time without stage times', () => {
    const facts = modelRunFacts({
      startedAt: '2026-10-09T09:17:36.000Z',
      finishedAt: '2026-10-09T09:17:38.000Z',
      modelName: 'U-Net',
      modelVersion: 'v1',
    })
    expect(facts.model).toBe('U-Net, version v1')
    expect(facts.totalMs).toBe(2000)
    expect(facts.stages).toEqual([])
  })
})

describe('geospatial figures', () => {
  it('gives debris pixels, debris area, scene coverage and scene area', () => {
    expect(debrisFigures(GEO)).toEqual({
      debrisPixels: 183,
      debrisArea: '1.83 ha',
      coverage: '0.28%',
      sceneArea: '6.55 km²',
    })
  })

  it('splits a measure into its figure and unit', () => {
    expect(measureParts('1.83 ha')).toEqual({ figure: '1.83', unit: 'ha' })
    expect(measureParts('<0.01 km²')).toEqual({ figure: '<0.01', unit: 'km²' })
    expect(measureParts('0.28%')).toEqual({ figure: '0.28%', unit: '' })
  })

  it('lists pixel area, areas and the debris centroid', () => {
    const rows = geospatialDetailRows(GEO)
    expect(valueOf(rows, 'Pixel area')).toBe('100 m²')
    expect(valueOf(rows, 'Total scene area')).toBe('6.55 km² (65,536 px)')
    expect(valueOf(rows, 'Debris area')).toBe('1.83 ha (183 px)')
    expect(valueOf(rows, 'Centroid latitude (debris)')).toBe('15.834611° N')
    expect(valueOf(rows, 'Centroid longitude (debris)')).toBe('86.861061° W')
  })

  it('reports the image centre, and says so, when there is no debris', () => {
    const empty = {
      ...GEO,
      debrisPixels: 0,
      debrisAreaM2: 0,
      debrisCoveragePercent: 0,
      debrisCentroid: null,
    }
    expect(reportCentroid(empty)).toEqual({ point: GEO.sceneCentre, ofDebris: false })
    const rows = geospatialDetailRows(empty)
    expect(valueOf(rows, 'Centroid latitude (image centre, no debris)')).toBe('15.831483° N')
    expect(debrisFigures(empty).coverage).toBe('0%')
  })
})

describe('segmentation and QGIS', () => {
  it('keeps the class colours equal to the shipped QGIS style', () => {
    const entries = [
      ...qml.matchAll(/<paletteEntry[^>]*label="([^"]+)" value="(\d+)" color="(#[0-9a-f]{6})"/g),
    ]
      .map(([, name, id, color]) => ({ id: Number(id), name, color }))
      .filter((entry) => entry.id <= 11)
    expect(entries).toEqual(QGIS_CLASS_STYLE)
  })

  it('builds the legend from the class counts, largest first, without absent classes', () => {
    const context: SceneContext = {
      validPixels: 1000,
      debrisPercent: 1,
      cloudPercent: 0,
      shipPercent: 0,
      foamPercent: 0,
      sargassumPercent: 0,
      naturalOrganicPercent: 0,
      classPixelCounts: { '1': 10, '7': 900, '9': 90, '6': 0 },
    }
    const legend = segmentationLegend({ sceneContext: context })
    expect(legend.map((e) => [e.name, e.pixels, e.percent])).toEqual([
      ['Marine Water', 900, 90],
      ['Foam', 90, 9],
      ['Marine Debris', 10, 1],
    ])
    expect(legend[2]?.color).toBe('#ff0000')
    expect(segmentationLegend({})).toEqual([])
  })

  it('names the downloads', () => {
    expect(segmentationFileName({ id: 'S2_9-10-17_16PEC_0' })).toBe(
      'S2_9-10-17_16PEC_0_segmentation.tif',
    )
    expect(qgisStyleUrl('/')).toBe('/qgis/qgis_color_mask_mapping.qml')
  })
})
