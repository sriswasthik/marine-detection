import { ObservationGlyph, type ObservationGlyphProps } from '@/components/ui'
import { useObservation } from '../hooks'

/**
 * The glyph for a list row, where only the summary is at hand: loads the observation's detections
 * (cached and shared with its pages) and draws the empty frame until they arrive.
 */
export function ObservationGlyphById({
  id,
  ...rest
}: { id: string } & Omit<ObservationGlyphProps, 'observation'>) {
  const query = useObservation(id)
  return <ObservationGlyph observation={query.data?.data ?? null} {...rest} />
}
