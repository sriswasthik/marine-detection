import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SeverityTag, Tag } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatCoveragePercent, formatDate, formatInteger } from '@/lib/format'
import { hasApproximatePositions, isLowConfidenceResult } from '@/lib/warnings'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '../labels'
import type { ObservationSummary } from '../types'
import { ObservationGlyphById } from './ObservationGlyphById'

/** Column layout shared by the row and the list header. */
const OBSERVATION_ROW_GRID =
  'md:grid md:grid-cols-[minmax(0,1fr)_8rem_6rem_6rem_7rem_1rem] md:items-center md:gap-4'

/**
 * One observation as a ledger row: glyph, region, date and source, severity, coverage, detections
 * and status. The whole row links to the detail page; hovering nudges it 2px.
 */
export function ObservationRow({ observation }: { observation: ObservationSummary }) {
  return (
    <Link
      to={`/observations/${encodeURIComponent(observation.id)}`}
      className={cn(
        'group flex flex-col gap-2 py-3 transition-transform duration-[120ms] ease-out hover:translate-x-[2px]',
        'focus-visible:-outline-offset-2',
        OBSERVATION_ROW_GRID,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <ObservationGlyphById id={observation.id} size={24} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium text-ink">{observation.region}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="data text-ink-2">
              {formatDate(observation.capturedAt)} · {SOURCE_LABELS[observation.source]}
            </span>
            {/* Caveats travel with the result, here as on the map and the detail page. */}
            {observation.detectionCount > 0 && isLowConfidenceResult(observation) ? (
              <Tag tone="warning">Low confidence</Tag>
            ) : null}
            {hasApproximatePositions(observation) ? (
              <Tag tone="warning">Approximate positions</Tag>
            ) : null}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-9 md:contents">
        <span className="md:justify-self-start">
          <span className="sr-only">Density level: </span>
          {observation.densityLevel ? (
            <SeverityTag level={observation.densityLevel} variant="plain" />
          ) : (
            <span className="text-small text-ink-2">No debris</span>
          )}
        </span>
        <span className="data text-ink md:text-right">
          <span className="sr-only">Coverage: </span>
          {formatCoveragePercent(observation.coveragePercent)}
          <span className="text-ink-2 md:hidden"> coverage</span>
        </span>
        <span className="data text-ink md:text-right">
          <span className="sr-only">Detections: </span>
          {formatInteger(observation.detectionCount)}
          <span className="text-ink-2 md:hidden">
            {observation.detectionCount === 1 ? ' detection' : ' detections'}
          </span>
        </span>
        <span className="md:justify-self-end">
          <span className="sr-only">Status: </span>
          {observation.status === 'completed' ? (
            // The usual case stays quiet: on narrow screens it is left to screen readers so the
            // row keeps to two lines; only statuses that need attention get a badge.
            <span className="sr-only md:not-sr-only md:inline-flex md:items-center md:gap-2 md:text-small md:text-ink-2">
              <span aria-hidden className="size-1.5 bg-success" />
              {STATUS_LABELS.completed}
            </span>
          ) : (
            <Tag tone={STATUS_TONES[observation.status]}>{STATUS_LABELS[observation.status]}</Tag>
          )}
        </span>
      </span>
      <ChevronRight aria-hidden className="hidden size-4 text-ink-2 md:block" />
    </Link>
  )
}

/** Column labels for a list of ObservationRow rows (desktop only; rows carry their own labels). */
export function ObservationListHeader() {
  return (
    <div
      aria-hidden
      className={cn('label hidden border-b border-rule pb-2 text-ink-2', OBSERVATION_ROW_GRID)}
    >
      <span>Observation</span>
      <span>Density</span>
      <span className="text-right">Coverage</span>
      <span className="text-right">Detections</span>
      <span className="text-right">Status</span>
      <span />
    </div>
  )
}
