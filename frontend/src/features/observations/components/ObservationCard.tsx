import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, SeverityBadge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatCoveragePercent, formatDate, formatInteger } from '@/lib/format'
import { hasApproximatePositions, isLowConfidenceResult } from '@/lib/warnings'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '../labels'
import type { ObservationSummary } from '../types'
import { SourceIcon } from './SourceIcon'

/** Column layout shared by the row and the list header. */
const OBSERVATION_ROW_GRID =
  'md:grid md:grid-cols-[minmax(0,1fr)_8rem_6rem_6rem_7rem_1rem] md:items-center md:gap-4'

/**
 * One observation as a list row: region, date and source, severity, coverage, detections and
 * status. The whole row links to the detail page.
 */
export function ObservationCard({ observation }: { observation: ObservationSummary }) {
  return (
    <Link
      to={`/observations/${encodeURIComponent(observation.id)}`}
      className={cn(
        'group flex flex-col gap-2 px-1 py-3.5 transition-colors duration-150 ease-out hover:bg-surface',
        'focus-visible:outline-offset-0 md:-mx-3 md:px-3',
        OBSERVATION_ROW_GRID,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <SourceIcon source={observation.source} className="size-4 shrink-0 text-ink-muted" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium text-ink">{observation.region}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="num text-caption text-ink-muted">
              {formatDate(observation.capturedAt)} · {SOURCE_LABELS[observation.source]}
            </span>
            {/* Caveats travel with the result, here as on the map and the detail page. */}
            {observation.detectionCount > 0 && isLowConfidenceResult(observation) ? (
              <Badge tone="warning" className="h-5">
                Low confidence
              </Badge>
            ) : null}
            {hasApproximatePositions(observation) ? (
              <Badge tone="warning" className="h-5">
                Approximate positions
              </Badge>
            ) : null}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7 md:contents">
        <span className="md:justify-self-start">
          <span className="sr-only">Density level: </span>
          {observation.densityLevel ? (
            <SeverityBadge level={observation.densityLevel} />
          ) : (
            <Badge>No debris</Badge>
          )}
        </span>
        <span className="num text-small text-ink md:text-right">
          <span className="sr-only">Coverage: </span>
          {formatCoveragePercent(observation.coveragePercent)}
          <span className="text-ink-muted md:hidden"> coverage</span>
        </span>
        <span className="num text-small text-ink md:text-right">
          <span className="sr-only">Detections: </span>
          {formatInteger(observation.detectionCount)}
          <span className="text-ink-muted md:hidden">
            {observation.detectionCount === 1 ? ' detection' : ' detections'}
          </span>
        </span>
        <span className="md:justify-self-end">
          <span className="sr-only">Status: </span>
          {observation.status === 'completed' ? (
            // The usual case stays quiet; only statuses that need attention get a badge.
            <span className="inline-flex items-center gap-1.5 text-small text-ink-muted">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              {STATUS_LABELS.completed}
            </span>
          ) : (
            <Badge tone={STATUS_TONES[observation.status]}>
              {STATUS_LABELS[observation.status]}
            </Badge>
          )}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="hidden size-4 text-ink-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5 md:block"
      />
    </Link>
  )
}

/** Column labels for a list of ObservationCard rows (desktop only; rows carry their own labels). */
export function ObservationListHeader() {
  return (
    <div
      aria-hidden
      className={cn(
        'hidden pb-2 text-caption font-medium text-ink-muted md:-mx-3 md:px-3',
        OBSERVATION_ROW_GRID,
      )}
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
