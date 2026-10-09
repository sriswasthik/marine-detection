import { SectionLabel } from '@/components/ui'
import { FactList } from '@/features/evidence/ObservationFacts'
import { imageFactRows, type ImageFacts } from '@/lib/analysisReport'

/** Bands, width, height and coordinate reference system of the chosen or analysed image. */
export function ImageFactsSection({
  facts,
  source,
  title = 'Uploaded image',
}: {
  facts: ImageFacts
  /** Where the facts were read, in a few words. */
  source: string
  title?: string
}) {
  return (
    <section aria-labelledby="image-facts-title" className="flex flex-col gap-3">
      <SectionLabel id="image-facts-title">{title}</SectionLabel>
      <FactList rows={imageFactRows(facts)} />
      <p className="text-small text-ink-2">{source}</p>
    </section>
  )
}
