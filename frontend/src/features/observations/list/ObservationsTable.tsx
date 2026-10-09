import { ArrowDown, ArrowUp, ArrowUpDown, FileSearch, Map as MapIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SeverityTag, Tag, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatConfidence, formatCoveragePercent, formatDate, formatInteger } from '@/lib/format'
import { nextListSort, type ListQuery, type ListSortKey } from '@/lib/observationList'
import { hasApproximatePositions, isLowConfidenceResult } from '@/lib/warnings'
import { SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from '../labels'
import type { ObservationSummary } from '../types'
import { ObservationGlyphById } from '../components/ObservationGlyphById'
import { SourceIcon } from '../components/SourceIcon'
import { RowExportMenu } from './RowExportMenu'

const COLUMNS: readonly {
  key: ListSortKey
  label: string
  numeric?: boolean
  className?: string
}[] = [
  { key: 'region', label: 'Region', className: 'min-w-56' },
  // Every current scene is satellite imagery: the column gives way first on narrower screens.
  { key: 'source', label: 'Source', className: 'hidden xl:table-cell' },
  { key: 'captured', label: 'Captured' },
  { key: 'status', label: 'Status' },
  { key: 'density', label: 'Density' },
  { key: 'coverage', label: 'Coverage', numeric: true },
  { key: 'detections', label: 'Detections', numeric: true },
  { key: 'confidence', label: 'Confidence', numeric: true },
]

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown aria-hidden className="size-3 opacity-40" />
  return direction === 'asc' ? (
    <ArrowUp aria-hidden className="size-3" />
  ) : (
    <ArrowDown aria-hidden className="size-3" />
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
    // Scrolls inside its own box below 1024px. Not above: a scrolling box would unstick the header.
    <div className="max-lg:overflow-x-auto">
      <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-small">
        <caption className="sr-only">
          Observations. Use the arrow keys to move between rows, Enter to open one, M to open it on
          the map.
        </caption>
        <thead>
          <tr className="text-left">
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
                    'label sticky top-[calc(var(--spacing-topbar)+var(--offline-bar-height,0px))] z-10 h-10 border-b border-rule bg-paper px-3 font-medium text-ink-2 first:pl-0',
                    column.numeric && 'text-right',
                    column.className,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(nextListSort(query, column.key))}
                    className={cn(
                      'label inline-flex h-8 items-center gap-1 hover:text-ink',
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
              className="sticky top-[calc(var(--spacing-topbar)+var(--offline-bar-height,0px))] z-10 border-b border-rule bg-paper pr-0 pl-3 text-right font-medium"
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
                className="group cursor-pointer outline-none hover:bg-ink/[0.03] focus-visible:bg-accent-wash"
              >
                <td className="border-b border-hairline py-2 pr-3">
                  <span className="flex min-w-0 items-start gap-3 transition-transform duration-[120ms] ease-out group-hover:translate-x-[2px]">
                    <ObservationGlyphById id={o.id} size={24} />
                    <span className="flex min-w-0 flex-col gap-1">
                      <Link
                        to={detailPath(o.id)}
                        tabIndex={-1}
                        className="truncate text-body font-medium text-ink underline-offset-4 group-hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-10 pointer-coarse:items-center"
                      >
                        {o.region}
                      </Link>
                      {o.maridaPatch ? (
                        <span className="truncate text-small text-ink-2">
                          Model output on MARIDA patch{' '}
                          <span className="data">{o.maridaPatch.id}</span>
                        </span>
                      ) : null}
                      {(o.detectionCount > 0 && isLowConfidenceResult(o)) ||
                      hasApproximatePositions(o) ? (
                        <span className="flex flex-wrap gap-1">
                          {o.detectionCount > 0 && isLowConfidenceResult(o) ? (
                            <Tag tone="warning">Low confidence</Tag>
                          ) : null}
                          {hasApproximatePositions(o) ? (
                            <Tag tone="warning">Approximate positions</Tag>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td className="hidden border-b border-hairline px-3 py-2 text-ink-2 xl:table-cell">
                  <span className="inline-flex items-center gap-2">
                    <SourceIcon source={o.source} className="size-4" />
                    {SOURCE_LABELS[o.source]}
                  </span>
                </td>
                <td className="data border-b border-hairline px-3 py-2 whitespace-nowrap text-ink">
                  {formatDate(o.capturedAt)}
                </td>
                <td className="border-b border-hairline px-3 py-2">
                  {o.status === 'completed' ? (
                    <span className="inline-flex items-center gap-2 text-ink-2">
                      <span aria-hidden className="size-1.5 bg-success" />
                      {STATUS_LABELS.completed}
                    </span>
                  ) : (
                    <Tag tone={STATUS_TONES[o.status]}>{STATUS_LABELS[o.status]}</Tag>
                  )}
                </td>
                <td className="border-b border-hairline px-3 py-2">
                  {noDebris || !o.densityLevel ? (
                    <span className="text-ink-2">No debris</span>
                  ) : (
                    <SeverityTag level={o.densityLevel} variant="plain" />
                  )}
                </td>
                <td className="data border-b border-hairline px-3 py-2 text-right text-ink">
                  {formatCoveragePercent(o.coveragePercent)}
                </td>
                <td className="data border-b border-hairline px-3 py-2 text-right text-ink">
                  {formatInteger(o.detectionCount)}
                </td>
                <td className="data border-b border-hairline px-3 py-2 text-right text-ink">
                  {formatConfidence(o.averageConfidence)}
                </td>
                <td className="border-b border-hairline py-2 pl-3">
                  <span className="flex items-center justify-end gap-1">
                    <Tooltip content="Open detail">
                      <Link
                        to={detailPath(o.id)}
                        aria-label={`Open detail for ${o.region}`}
                        className="inline-flex size-8 items-center justify-center rounded-control text-ink-2 hover:bg-ink/5 hover:text-ink"
                      >
                        <FileSearch aria-hidden className="size-4" />
                      </Link>
                    </Tooltip>
                    <Tooltip content="Open on map">
                      <Link
                        to={mapPath(o.id)}
                        aria-label={`Open ${o.region} on the map`}
                        className="inline-flex size-8 items-center justify-center rounded-control text-ink-2 hover:bg-ink/5 hover:text-ink"
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
