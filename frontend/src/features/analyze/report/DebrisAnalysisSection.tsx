import { SectionLabel, Sentence, SentenceFigure } from '@/components/ui'
import { FactList } from '@/features/evidence/ObservationFacts'
import type { GeospatialSummary } from '@/features/observations/types'
import { debrisFigures, geospatialDetailRows, measureParts } from '@/lib/analysisReport'
import { formatCoveragePercent, formatInteger } from '@/lib/format'

function MeasureFigure({ value, text }: { value: number; text: string }) {
  const { figure, unit } = measureParts(text)
  return <SentenceFigure value={value} format={() => figure} unit={unit || undefined} />
}

/**
 * Marine debris geospatial analysis: debris pixels, debris area, coverage and scene area as one
 * sentence, then the detailed figures (pixel area, scene and debris areas, the debris centroid).
 */
export function DebrisAnalysisSection({
  geospatial,
  waterCoveragePercent,
}: {
  geospatial: GeospatialSummary
  /** The observation's coveragePercent: debris over the water area rather than the whole scene. */
  waterCoveragePercent: number
}) {
  const figures = debrisFigures(geospatial)
  const pixelWord = figures.debrisPixels === 1 ? 'debris pixel' : 'debris pixels'
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <section aria-labelledby="debris-analysis-title" className="flex flex-col gap-4">
        <SectionLabel id="debris-analysis-title">Marine debris geospatial analysis</SectionLabel>
        <Sentence size="page">
          <SentenceFigure value={figures.debrisPixels} format={formatInteger} /> {pixelWord}{' '}
          covering <MeasureFigure value={geospatial.debrisAreaM2} text={figures.debrisArea} />,{' '}
          <MeasureFigure value={geospatial.debrisCoveragePercent} text={figures.coverage} /> of the{' '}
          <MeasureFigure value={geospatial.sceneAreaM2} text={figures.sceneArea} /> scene.
        </Sentence>
        <p className="text-small text-ink-2">
          Debris pixels are the model&apos;s Marine Debris pixels in the kept detections. Coverage
          is debris area over the whole scene; over the water area alone it is{' '}
          {formatCoveragePercent(waterCoveragePercent)}.
        </p>
      </section>
      <section aria-labelledby="geo-details-title" className="flex flex-col gap-3">
        <SectionLabel id="geo-details-title">Detailed geospatial information</SectionLabel>
        <FactList rows={geospatialDetailRows(geospatial)} />
      </section>
    </div>
  )
}
