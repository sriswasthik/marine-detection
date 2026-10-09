import { ArrowLink, Tag } from '@/components/ui'
import { isMockMode } from '@/features/observations/api'
import { ProvenanceTag } from '@/features/observations/components/ProvenanceTag'
import { SourceIcon } from '@/features/observations/components/SourceIcon'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '@/features/observations/labels'
import type { Observation } from '@/features/observations/types'
import { formatDateTime } from '@/lib/format'
import { observationProvenance } from '@/lib/provenance'

/**
 * The observation's title (the page's h1), when and how it was captured, its status and where
 * its figures come from. Breadcrumbs and the Export action sit in the context line above.
 */
export function ObservationHeader({
  observation,
  actions = true,
}: {
  observation: Observation
  /** Off for failed and unfinished observations: there is nothing to open. */
  actions?: boolean
}) {
  const mapPath = `/map/${encodeURIComponent(observation.id)}`
  const provenance = observationProvenance(observation, isMockMode())
  const provenanceNote = provenance.kind === 'model' ? provenance.note : null

  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-page text-ink">{observation.region}</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-small text-ink-2">
        <span className="data">
          <span className="sr-only">Captured </span>
          {formatDateTime(observation.capturedAt)}
        </span>
        <span className="inline-flex items-center gap-2">
          <SourceIcon source={observation.source} className="size-4" />
          {SOURCE_LABELS[observation.source]}
        </span>
        <Tag tone={STATUS_TONES[observation.status]}>{STATUS_LABELS[observation.status]}</Tag>
        <ProvenanceTag observation={observation} mockMode={isMockMode()} />
      </div>
      {provenanceNote ? (
        <p className="max-w-[68ch] text-small text-ink-2">{provenanceNote}</p>
      ) : null}
      {actions ? (
        <ArrowLink to={mapPath} className="self-start">
          Open on map
        </ArrowLink>
      ) : null}
    </header>
  )
}
