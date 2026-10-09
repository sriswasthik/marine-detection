import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from '@/features/observations/api/mockApi'
import { parseObservation } from '@/features/observations/schemas'
import type { Observation } from '@/features/observations/types'
// Real model output on sample_data/S2_9-10-17_16PEC_0.tif, written by backend/scripts/export_samples.py.
import sampleJson from '../../../../public/samples/S2_9-10-17_16PEC_0/observation.json?raw'
import { AnalysisReport } from './AnalysisReport'

const ID = 'S2_9-10-17_16PEC_0'

function sample(): Observation {
  const parsed = parseObservation(JSON.parse(sampleJson))
  if (!parsed.data) throw new Error('The exported sample does not parse')
  return parsed.data
}

function renderReport(observation: Observation) {
  const api = createMockApi({
    latencyMs: [0, 0],
    pollLatencyMs: [0, 0],
    realSamples: () => Promise.resolve([observation]),
  })
  render(
    <AppProviders api={api}>
      <AnalysisReport observationId={observation.id} />
    </AppProviders>,
  )
}

const row = (label: string) => {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.parentElement?.querySelector('dd')?.textContent
}

describe('Analysis report', () => {
  it('shows the image, model run and geospatial figures of a real run', async () => {
    renderReport(sample())
    expect(await screen.findByRole('heading', { name: 'Analysis report' })).toBeInTheDocument()

    expect(row('Bands')).toBe('11')
    expect(row('Width')).toBe('256 px')
    expect(row('Height')).toBe('256 px')
    expect(row('Coordinate reference system')).toBe('EPSG:32616 · WGS 84 / UTM zone 16N')
    expect(row('Pixel size')).toBe('10 m × 10 m')

    expect(screen.getByText('Model loaded successfully')).toBeInTheDocument()
    expect(screen.getByText(/U-Net marine debris segmentation, version \w+, on cpu/)).toBeVisible()
    expect(screen.getByText('Prediction complete')).toBeInTheDocument()
    expect(screen.getByText(/Finished in .+ Model inference/)).toBeInTheDocument()

    const analysis = screen.getByRole('region', { name: 'Marine debris geospatial analysis' })
    expect(analysis).toHaveTextContent(
      /183 debris pixels covering 1\.83\s?ha, 0\.28% of the 6\.55\s?km² scene/,
    )
    expect(row('Pixel area')).toBe('100 m²')
    expect(row('Total scene area')).toBe('6.55 km² (65,536 px)')
    expect(row('Debris area')).toBe('1.83 ha (183 px)')
    expect(row('Centroid latitude (debris)')).toMatch(/^15\.\d{6}° N$/)
    expect(row('Centroid longitude (debris)')).toMatch(/^86\.\d{6}° W$/)
  })

  it('shows the image beside its mask, the layered map and the QGIS downloads', async () => {
    const user = userEvent.setup()
    renderReport(sample())
    await screen.findByRole('heading', { name: 'Analysis report' })

    const mask = screen.getByRole('img', { name: /Predicted segmentation mask/ })
    expect(mask).toHaveAttribute('src', `/samples/${ID}/segmentation.png`)
    expect(screen.getByRole('img', { name: /True-colour view/ })).toHaveAttribute(
      'src',
      `/samples/${ID}/scene.png`,
    )
    const legend = screen.getByRole('table', { name: 'Pixels per predicted class' })
    expect(within(legend).getByText('Marine Debris')).toBeInTheDocument()

    const osm = screen.getByRole('radio', { name: 'OpenStreetMap' })
    const satellite = screen.getByRole('radio', { name: 'Satellite' })
    expect(osm).toBeChecked()
    await user.click(satellite)
    expect(satellite).toBeChecked()
    const image = screen.getByRole('checkbox', { name: 'Uploaded satellite image' })
    const detections = screen.getByRole('checkbox', { name: /AI marine debris detection \(\d+\)/ })
    expect(image).toBeChecked()
    expect(detections).toBeChecked()
    await user.click(image)
    expect(image).not.toBeChecked()

    const tif = screen.getByRole('link', { name: 'Download segmentation GeoTIFF' })
    expect(tif).toHaveAttribute('href', `/samples/${ID}/segmentation.tif`)
    expect(tif).toHaveAttribute('download', `${ID}_segmentation.tif`)
    const qml = screen.getByRole('link', { name: 'Download QGIS style (.qml)' })
    expect(qml).toHaveAttribute('href', '/qgis/qgis_color_mask_mapping.qml')
    expect(screen.getByText(/Load Style at the bottom/)).toBeInTheDocument()
  })

  it('reports the image centre when no debris was detected', async () => {
    const observation = sample()
    const geospatial = observation.geospatial
    if (!geospatial) throw new Error('The sample has no geospatial summary')
    renderReport({
      ...observation,
      detections: [],
      geospatial: {
        ...geospatial,
        debrisPixels: 0,
        debrisAreaM2: 0,
        debrisCoveragePercent: 0,
        debrisCentroid: null,
      },
    })
    await screen.findByRole('heading', { name: 'Analysis report' })
    expect(
      screen.getByRole('region', { name: 'Marine debris geospatial analysis' }),
    ).toHaveTextContent(/0 debris pixels covering/)
    expect(row('Centroid latitude (image centre, no debris)')).toMatch(/° N$/)
  })
})
