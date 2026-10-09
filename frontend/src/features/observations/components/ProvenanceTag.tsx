import { Tag } from '@/components/ui'
import { observationProvenance } from '@/lib/provenance'
import type { Observation } from '../types'

/** "Sample data" for synthetic scenes, "Model output on MARIDA patch <id>" for real ones. */
export function ProvenanceTag({
  observation,
  mockMode,
  quiet = false,
  className,
}: {
  observation: Pick<Observation, 'maridaPatch'>
  mockMode: boolean
  /** A hairline outline with the warning swatch, no fill: for dense toolbars. */
  quiet?: boolean
  className?: string
}) {
  const provenance = observationProvenance(observation, mockMode)
  if (provenance.kind === 'live') return null
  if (provenance.kind === 'sample') {
    return quiet ? (
      <Tag
        tone="neutral"
        icon={<span aria-hidden className="size-2 bg-warning" />}
        className={className}
      >
        Sample data
      </Tag>
    ) : (
      <Tag tone="warning" className={className}>
        Sample data
      </Tag>
    )
  }
  return (
    <Tag tone={quiet ? 'neutral' : 'accent'} className={className}>
      {provenance.label}
    </Tag>
  )
}
