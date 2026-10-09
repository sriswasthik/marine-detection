import { Ledger, SectionLabel, type LedgerColumn } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { segmentationLegend, type LegendEntry } from '@/lib/analysisReport'
import { formatCoveragePercent, formatInteger } from '@/lib/format'

const LEGEND_COLUMNS: readonly LedgerColumn<LegendEntry>[] = [
  {
    id: 'class',
    header: 'Class',
    render: (entry) => (
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 shrink-0 border border-ink/20"
          style={{ backgroundColor: entry.color }}
        />
        <span className="data text-ink-2">{entry.id}</span>
        {entry.name}
      </span>
    ),
  },
  { id: 'pixels', header: 'Pixels', numeric: true, render: (e) => formatInteger(e.pixels) },
  {
    id: 'share',
    header: 'Share',
    numeric: true,
    render: (e) => formatCoveragePercent(e.percent),
  },
]

function Plate({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <img
        src={src}
        alt={alt}
        className="aspect-square w-full border border-rule bg-sheet object-contain [image-rendering:pixelated]"
      />
      <figcaption className="text-small text-ink-2">{caption}</figcaption>
    </figure>
  )
}

/**
 * The image and the model's predicted segmentation mask side by side, on the same pixel grid, with
 * each class's colour (the QGIS style's) and pixel count.
 */
export function SegmentationSection({
  observation,
}: {
  observation: Pick<
    Observation,
    'name' | 'id' | 'sceneImageUrl' | 'segmentationPreviewUrl' | 'previewUrl' | 'sceneContext'
  >
}) {
  const imageUrl = observation.sceneImageUrl ?? observation.previewUrl
  const maskUrl = observation.segmentationPreviewUrl
  const legend = segmentationLegend(observation)
  const name = observation.name ?? observation.id
  return (
    <section aria-labelledby="segmentation-title" className="flex flex-col gap-4">
      <SectionLabel id="segmentation-title">Predicted segmentation mask</SectionLabel>
      {maskUrl ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="grid gap-4 sm:grid-cols-2">
            {imageUrl ? (
              <Plate
                src={imageUrl}
                alt={`True-colour view of ${name}`}
                caption="Uploaded image, true colour (665, 560 and 490 nm)"
              />
            ) : null}
            <Plate
              src={maskUrl}
              alt={`Predicted segmentation mask of ${name}, one colour per class`}
              caption="Predicted mask, one colour per class, as in QGIS with the style below"
            />
          </div>
          {legend.length > 0 ? (
            <Ledger
              caption="Pixels per predicted class"
              columns={LEGEND_COLUMNS}
              rows={legend}
              rowKey={(entry) => String(entry.id)}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-small text-ink-2">
          This result has no segmentation mask. Masks come with results from the processing service;
          sample data has none.
        </p>
      )}
    </section>
  )
}
