import { ArrowDown, ArrowUp, ArrowUpDown, FileSearch, Map as MapIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, SeverityBadge, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatConfidence, formatCoveragePercent, formatDate, formatInteger } from '@/lib/format'
import { nextListSort, type ListQuery, type ListSortKey } from '@/lib/observationList'
import { hasApproximatePositions, isLowConfidenceResult } from '@/lib/warnings'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '../labels'
import type { ObservationSummary } from '../types'
import { SourceIcon } from '../components/SourceIcon'
import { RowExportMenu } from './RowExportMenu'

const COLUMNS: readonly {
  key: ListSortKey
  label: string
  numeric?: boolean
  className?: string
}[] = [
  { key: 'region', label: 'Region', className: 'min-w-56' },
  { key: 'source', label: 'Source' },
  { key: 'captured', label: 'Captured' },
  { key: 'status', label: 'Status' },
  { key: 'density', label: 'Density' },
  { key: 'coverage', label: 'Coverage', numeric: true },
  { key: 'detections', label: 'Detections', numeric: true },
  { key: 'confidence', label: 'Confidence', numeric: true },
]

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />
  return direction === 'asc' ? (
    <ArrowUp aria-hidden className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden className="size-3.5" />
  )
}

const detailPath = (id: string) => `/observations/${encodeURIComponent(id)}`
const mapPath = (id: string) => `/map/${encodeURIComponent(id)}`

/**
 * Every observation as one quiet row. Columns sort on click. Rows are a single tab stop: arrow keys
 * move between rows, Home and End jump, Enter opens the detail page, M opens the map.
 */
export function ObservationsTable({
  observations,
  query,
  onSort,
}: {
  observations: readonly ObservationSummary[]
  query: ListQuery
  onSort: (sort: Pick<ListQuery, 'sort' | 'direction'>) => void
}) {
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const current = Math.min(activeIndex, Math.max(0, observations.length - 1))

  const focusRow = (index: number) => {
    const next = Math.max(0, Math.min(observations.length - 1, index))
    setActiveIndex(next)
    rowRefs.current[next]?.focus()
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    // Keys typed into the row's own buttons and links keep their usual meaning.
    if (event.target !== event.currentTarget) return
    const observation = observations[index]
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusRow(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusRow(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusRow(0)
        break
      case 'End':
        event.preventDefault()
        focusRow(observations.length - 1)
        break
      case 'Enter':
        event.preventDefault()
        if (observation) navigate(detailPath(observation.id))
        break
      case 'm':
      case 'M':
        event.preventDefault()
        if (observation) navigate(mapPath(observation.id))
        break
    }
  }

  return (
    <div className="max-md:overflow-x-auto">
      <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-small">
        <caption className="sr-only">
          Observations. Use the arrow keys to move between rows, Enter to open one, M to open it on
          the map.
        </caption>
        <thead>
          <tr className="text-left text-caption text-ink-muted">
            {COLUMNS.map((column) => {
              const active = query.sort === column.key
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active ? (query.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  className={cn(
                    // Sticky under the top bar while the page scrolls.
                    'sticky top-[calc(var(--spacing-topbar)+var(--offline-bar-height,0px))] z-10 border-b border-border bg-bg px-2 py-2 font-medium first:pl-0',
                    column.numeric && 'text-right',
                    column.className,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(nextListSort(query, column.key))}
                    className={cn(
                      '-mx-1 inline-flex items-center gap-1 rounded-[4px] px-1 py-0.5 hover:text-ink',
                      active && 'text-ink',
                      column.numeric && 'flex-row-reverse',
                    )}
                  >
                    {column.label}
                    <SortIcon active={active} direction={query.direction} />
                  </button>
                </th>
              )
            })}
            <th
              scope="col"
              className="sticky top-[calc(var(--spacing-topbar)+var(--offline-bar-height,0px))] z-10 border-b border-border bg-bg py-2 pr-0 pl-2 text-right font-medium"
            >
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {observations.map((o, index) => {
            const noDebris = o.detectionCount === 0
            return (
              <tr
                key={o.id}
                ref={(el) => {
                  rowRefs.current[index] = el
                }}
                tabIndex={index === current ? 0 : -1}
                aria-label={`${o.region}, ${formatDate(o.capturedAt)}`}
                onFocus={(event) => {
                  if (event.target === event.currentTarget) setActiveIndex(index)
                }}
                onKeyDown={(event) => onRowKeyDown(event, index)}
                onClick={(event) => {
                  // A click on the row (not on its links or buttons) opens the detail page.
                  if ((event.target as HTMLElement).closest('a, button')) return
                  navigate(detailPath(o.id))
                }}
                className="group cursor-pointer outline-none hover:bg-surface focus-visible:bg-accent-soft"
              >
                <td className="border-b border-border py-2 pr-2">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      to={detailPath(o.id)}
                      tabIndex={-1}
                      className="truncate font-medium text-ink group-hover:underline"
                    >
                      {o.region}
                    </Link>
                    {(o.detectionCount > 0 && isLowConfidenceResult(o)) ||
                    hasApproximatePositions(o) ? (
                      <span className="flex flex-wrap gap-1">
                        {o.detectionCount > 0 && isLowConfidenceResult(o) ? (
                          <Badge tone="warning" className="h-5">
                            Low confidence
                          </Badge>
                        ) : null}
                        {hasApproximatePositions(o) ? (
                          <Badge tone="warning" className="h-5">
                            Approximate positions
                          </Badge>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="border-b border-border px-2 py-2 text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <SourceIcon source={o.source} className="size-4" />
                    {SOURCE_LABELS[o.source]}
                  </span>
                </td>
                <td className="num border-b border-border px-2 py-2 whitespace-nowrap text-ink">
                  {formatDate(o.capturedAt)}
                </td>
                <td className="border-b border-border px-2 py-2">
                  {o.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1.5 text-ink-muted">
                      <span aria-hidden className="size-1.5 rounded-full bg-success" />
                      {STATUS_LABELS.completed}
                    </span>
                  ) : (
                    <Badge tone={STATUS_TONES[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                  )}
                </td>
                <td className="border-b border-border px-2 py-2">
                  {noDebris || !o.densityLevel ? (
                    <Badge>No debris</Badge>
                  ) : (
                    <SeverityBadge level={o.densityLevel} variant="plain" />
                  )}
                </td>
                <td className="num border-b border-border px-2 py-2 text-right text-ink">
                  {formatCoveragePercent(o.coveragePercent)}
                </td>
                <td className="num border-b border-border px-2 py-2 text-right text-ink">
                  {formatInteger(o.detectionCount)}
                </td>
                <td className="num border-b border-border px-2 py-2 text-right text-ink">
                  {formatConfidence(o.averageConfidence)}
                </td>
                <td className="border-b border-border py-1.5 pl-2">
                  <span className="flex items-center justify-end gap-0.5">
                    <Tooltip content="Open detail">
                      <Link
                        to={detailPath(o.id)}
                        aria-label={`Open detail for ${o.region}`}
                        className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-bg hover:text-ink"
                      >
                        <FileSearch aria-hidden className="size-4" />
                      </Link>
                    </Tooltip>
                    <Tooltip content="Open on map">
                      <Link
                        to={mapPath(o.id)}
                        aria-label={`Open ${o.region} on the map`}
                        className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-bg hover:text-ink"
                      >
                        <MapIcon aria-hidden className="size-4" />
                      </Link>
                    </Tooltip>
                    <RowExportMenu observation={o} />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
