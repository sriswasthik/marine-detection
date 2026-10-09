import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, ConfidenceTag, SectionLabel, SeverityTag } from '@/components/ui'
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
import { formatInteger, shortId } from '@/lib/format'
import { useFormat } from '@/features/settings/settingsContext'

const COLUMNS: readonly {
  key: DetectionSortKey
  label: string
  numeric?: boolean
  className?: string
}[] = [
  { key: 'id', label: 'ID' },
  { key: 'density', label: 'Density' },
  { key: 'area', label: 'Area', numeric: true },
  { key: 'confidence', label: 'Confidence', className: 'max-sm:pr-4' },
  // Phones: the centroid is in the detection's drawer; the table keeps to four columns.
  { key: 'centroid', label: 'Centroid', className: 'hidden sm:table-cell' },
]

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown aria-hidden className="size-3 opacity-50" />
  return direction === 'asc' ? (
    <ArrowUp aria-hidden className="size-3" />
  ) : (
    <ArrowDown aria-hidden className="size-3" />
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
  const fmt = useFormat()
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
    <section aria-labelledby="detections-title" className="flex flex-col gap-3">
      <SectionLabel id="detections-title" count={formatInteger(detections.length)}>
        Detections
      </SectionLabel>
      <p className="text-small text-ink-2">
        {formatInteger(detections.length)} {detections.length === 1 ? 'region' : 'regions'}. Select
        a row to focus it in the viewer.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-small sm:min-w-[36rem]">
          <caption className="sr-only">
            Detections, sorted by {COLUMNS.find((c) => c.key === sort.key)?.label.toLowerCase()}{' '}
            {sort.direction === 'asc' ? 'ascending' : 'descending'}
          </caption>
          <thead className="sticky top-0 z-10 bg-paper">
            <tr className="border-b border-rule text-left">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort(sort, column.key)}
                  className={cn(
                    'label h-10 px-3 font-medium text-ink-2 first:pl-0 last:pr-0',
                    column.numeric && 'text-right',
                    column.className,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSort((current) => nextSort(current, column.key))}
                    className={cn(
                      'label inline-flex h-8 items-center gap-1 hover:text-ink',
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
                    'group cursor-pointer border-b border-hairline',
                    selected ? 'bg-accent-wash' : 'hover:bg-ink/[0.03]',
                  )}
                >
                  <td className="h-10 px-3 pl-0 pointer-coarse:h-12">
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
                        'data inline-block transition-transform duration-[120ms] ease-out group-hover:translate-x-[2px] hover:underline',
                        selected ? 'font-medium text-accent-ink' : 'text-ink',
                      )}
                    >
                      {shortId(detection.id)}
                    </button>
                  </td>
                  <td className="px-3">
                    <SeverityTag level={detection.densityLevel} variant="plain" />
                  </td>
                  <td className="data px-3 text-right whitespace-nowrap text-ink">
                    {fmt.area(detection.areaM2)}
                  </td>
                  <td className="px-3 max-sm:pr-0">
                    <ConfidenceTag value={detection.confidence} />
                  </td>
                  <td className="data hidden px-3 pr-0 whitespace-nowrap text-ink-2 sm:table-cell">
                    {fmt.coordinates(detection.centroid)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {remaining > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <p className="text-small text-ink-2" aria-live="polite">
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
    </section>
  )
}
