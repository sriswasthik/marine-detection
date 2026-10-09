import { Banner, SkeletonSection } from '@/components/ui'
import { ProvenanceTag } from '@/features/observations/components/ProvenanceTag'
import { useObservation } from '@/features/observations/hooks'
import { useSettings } from '@/features/settings/settingsContext'
import { imageFactsFromGeospatial } from '@/lib/analysisReport'
import { DebrisAnalysisSection } from './DebrisAnalysisSection'
import { ImageFactsSection } from './ImageFactsSection'
import { ModelRunSection } from './ModelRunSection'
import { QgisSection } from './QgisSection'
import { ResultMapSection } from './ResultMapSection'
import { SegmentationSection } from './SegmentationSection'

/**
 * Everything one run produced, on the Analyze page: the image's facts, the model run, the debris
 * figures, the image beside its segmentation mask, a map with switchable basemaps and layers, and
 * the GeoTIFF and QGIS style to take the result into QGIS.
 */
export function AnalysisReport({ observationId }: { observationId: string }) {
  const query = useObservation(observationId)
  const mockMode = useSettings().dataSource === 'mock'

  if (query.isPending) return <SkeletonSection />
  if (query.isError) {
    return (
      <Banner tone="danger" title="The report could not be loaded">
        The result was saved, but its details did not arrive. Open the map to see it, or reload the
        page to try again.
      </Banner>
    )
  }

  const observation = query.data.data
  const geospatial = observation.geospatial
  const name = observation.name ?? observation.id
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-title text-ink">Analysis report</h2>
        <ProvenanceTag observation={observation} mockMode={mockMode} />
      </div>

      {geospatial ? (
        <div className="grid gap-12 lg:grid-cols-2">
          <ImageFactsSection
            facts={imageFactsFromGeospatial(geospatial)}
            source="Read from the GeoTIFF by the processing service."
          />
          {observation.processing ? <ModelRunSection processing={observation.processing} /> : null}
        </div>
      ) : (
        <>
          {observation.processing ? <ModelRunSection processing={observation.processing} /> : null}
          <p className="text-small text-ink-2">
            Image facts and geospatial figures come with results from the processing service; this
            result has none.
          </p>
        </>
      )}

      {geospatial ? (
        <DebrisAnalysisSection
          geospatial={geospatial}
          waterCoveragePercent={observation.coveragePercent}
        />
      ) : null}

      <SegmentationSection observation={observation} />

      <ResultMapSection
        bounds={observation.bounds}
        imageUrl={observation.previewUrl || null}
        detections={observation.detections}
        name={name}
      />

      <QgisSection observation={observation} />
    </div>
  )
}
