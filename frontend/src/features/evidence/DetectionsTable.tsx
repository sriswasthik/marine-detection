import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card, ConfidenceBadge, SeverityBadge } from '@/components/ui'
import type { Detection } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import {
  ariaSort,
  DEFAULT_DETECTION_SORT,
  DETECTION_PAGE_SIZE,
  nextSort,
  sortDetections,
  visibleRowCount,
  type DetectionSort,
  type DetectionSortKey,
} from '@/lib/detectionTable'
import { formatArea, formatCoordinates, formatInteger, shortId } from '@/lib/format'

const COLUMNS: readonly { key: DetectionSortKey; label: string; numeric?: boolean }[] = [
  { key: 'id', label: 'ID' },
  { key: 'density', label: 'Density' },
  { key: 'area', label: 'Area', numeric: true },
  { key: 'confidence', label: 'Confidence' },
  { key: 'centroid', label: 'Centroid' },
]

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown aria-hidden className="size-3.5 opacity-50" />
  return direction === 'asc' ? (
    <ArrowUp aria-hidden className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden className="size-3.5" />
  )
}

export interface DetectionsTableProps {
  detections: readonly Detection[]
  selectedId: string | null
  /** Hovering or focusing a row highlights its outline in the viewer. */
  onHighlight: (id: string | null) => void
  /** Clicking a row focuses the detection in the viewer. */
  onFocus: (id: string) => void
}

/**
 * Every detection, sortable by any column. Renders one page at a time ("Show more"), so large
 * results stay quick. The selected detection's row is always rendered, however far down it is.
 */
export function DetectionsTable({
  detections,
  selectedId,
  onHighlight,
  onFocus,
}: DetectionsTableProps) {
  const [sort, setSort] = useState<DetectionSort>(DEFAULT_DETECTION_SORT)
  const [expanded, setExpanded] = useState(0)
  const sorted = useMemo(() => sortDetections(detections, sort), [detections, sort])
  const selectedIndex = selectedId ? sorted.findIndex((d) => d.id === selectedId) : -1
  const count = visibleRowCount({
    current: expanded,
    total: sorted.length,
    mustShowIndex: selectedIndex,
  })
  const rows = sorted.slice(0, count)
  const remaining = sorted.length - count

  return (
    <Card
      title="Detections"
      headingLevel={2}
      padding="none"
      description={`${formatInteger(detections.length)} ${detections.length === 1 ? 'region' : 'regions'}. Select a row to focus it in the viewer.`}
      className="[&>header]:px-6 [&>header]:pt-5"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-small">
          <caption className="sr-only">
            Detections, sorted by {COLUMNS.find((c) => c.key === sort.key)?.label.toLowerCase()}{' '}
            {sort.direction === 'asc' ? 'ascending' : 'descending'}
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-caption text-ink-muted">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort(sort, column.key)}
                  className={cn(
                    'px-2 py-2 font-medium first:pl-6 last:pr-6',
                    column.numeric && 'text-right',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSort((current) => nextSort(current, column.key))}
                    className={cn(
                      '-mx-1 inline-flex items-center gap-1 rounded-[4px] px-1 py-0.5 hover:text-ink',
                      sort.key === column.key && 'text-ink',
                      column.numeric && 'flex-row-reverse',
                    )}
                  >
                    {column.label}
                    <SortIcon active={sort.key === column.key} direction={sort.direction} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody onMouseLeave={() => onHighlight(null)}>
            {rows.map((detection) => {
              const selected = detection.id === selectedId
              return (
                <tr
                  key={detection.id}
                  aria-selected={selected}
                  onMouseEnter={() => onHighlight(detection.id)}
                  onClick={() => onFocus(detection.id)}
                  className={cn(
                    'cursor-pointer border-b border-border transition-colors duration-150 ease-out last:border-0',
                    selected ? 'bg-accent-soft' : 'hover:bg-bg',
                  )}
                >
                  <td className="px-2 py-1.5 pl-6">
                    <button
                      type="button"
                      title={detection.id}
                      aria-label={`Focus detection ${shortId(detection.id)}`}
                      onFocus={() => onHighlight(detection.id)}
                      onBlur={() => onHighlight(null)}
                      onClick={(event) => {
                        event.stopPropagation()
                        onFocus(detection.id)
                      }}
                      className={cn(
                        'mono-label rounded-[4px] hover:underline',
                        selected ? 'font-semibold text-accent' : 'text-ink',
                      )}
                    >
                      {shortId(detection.id)}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <SeverityBadge level={detection.densityLevel} variant="plain" />
                  </td>
                  <td className="num px-2 py-1.5 text-right text-ink">
                    {formatArea(detection.areaM2)}
                  </td>
                  <td className="px-2 py-1.5">
                    <ConfidenceBadge value={detection.confidence} />
                  </td>
                  <td className="mono-label px-2 py-1.5 pr-6 whitespace-nowrap text-ink-muted">
                    {formatCoordinates(detection.centroid)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {remaining > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3">
          <p className="text-caption text-ink-muted" aria-live="polite">
            Showing {formatInteger(count)} of {formatInteger(sorted.length)}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExpanded(count + DETECTION_PAGE_SIZE)}
          >
            Show {formatInteger(Math.min(DETECTION_PAGE_SIZE, remaining))} more
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
