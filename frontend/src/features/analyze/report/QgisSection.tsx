import { Download } from 'lucide-react'
import { buttonStyles, SectionLabel } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import {
  QGIS_CLASS_STYLE,
  QGIS_STYLE_FILE_NAME,
  qgisStyleUrl,
  segmentationFileName,
} from '@/lib/analysisReport'

const STEPS = [
  'Download the segmentation GeoTIFF and the QGIS style below.',
  'In QGIS, add the GeoTIFF with Layer, Add Layer, Add Raster Layer, or drag it into the Layers panel. It opens in its own coordinate reference system, so it lines up with other layers.',
  `Open the layer's Properties, go to Symbology, choose Style, Load Style at the bottom, pick ${QGIS_STYLE_FILE_NAME} and press OK.`,
  'Each class now shows in its colour, Marine Debris in red. Add a basemap under it (XYZ Tiles, OpenStreetMap) to see where the debris lies.',
] as const

/**
 * The QGIS hand-off: the predicted class map as a GeoTIFF in the image's own CRS, the shipped .qml
 * style that colours it, and the steps to combine them.
 */
export function QgisSection({
  observation,
}: {
  observation: Pick<Observation, 'id' | 'segmentationUrl'>
}) {
  const tifUrl = observation.segmentationUrl
  return (
    <section aria-labelledby="qgis-title" className="flex flex-col gap-4">
      <SectionLabel id="qgis-title">QGIS visualization</SectionLabel>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className="max-w-[68ch] text-body text-ink">
            Apply the QML style in QGIS after loading the segmentation GeoTIFF. Pixel values are the
            class ids: {QGIS_CLASS_STYLE.map((entry) => `${entry.id} ${entry.name}`).join(', ')}; 0
            is no data.
          </p>
          <div className="flex flex-wrap gap-2">
            {tifUrl ? (
              <a
                href={tifUrl}
                download={segmentationFileName(observation)}
                className={buttonStyles({ variant: 'secondary' })}
              >
                <Download aria-hidden className="size-4" />
                Download segmentation GeoTIFF
              </a>
            ) : null}
            <a
              href={qgisStyleUrl()}
              download={QGIS_STYLE_FILE_NAME}
              className={buttonStyles({ variant: 'secondary' })}
            >
              <Download aria-hidden className="size-4" />
              Download QGIS style (.qml)
            </a>
          </div>
          {tifUrl ? null : (
            <p className="text-small text-ink-2">
              This result has no segmentation GeoTIFF. It comes with results from the processing
              service; sample data has none.
            </p>
          )}
        </div>
        <ol className="flex flex-col divide-y divide-hairline border-y border-hairline">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 py-3 text-small text-ink">
              <span className="data w-4 shrink-0 text-ink-2">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
