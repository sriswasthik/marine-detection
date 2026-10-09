import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { nextSort, sortRows, type LedgerSort, type SortValue } from '@/lib/ledger'

export interface LedgerColumn<T> {
  id: string
  /** Header text, set as a small-caps label. */
  header: string
  /** The unit, shown in the header ("Area, ha") instead of in every cell. */
  unit?: string
  /** Figures: mono, tabular and right-aligned. */
  numeric?: boolean
  render: (row: T) => ReactNode
  /** Makes the column sortable. */
  sortValue?: (row: T) => SortValue
  /** Width or visibility classes for the column's cells, for example "w-24" or "max-md:hidden". */
  className?: string
}

export interface LedgerProps<T> {
  /** Names the table for assistive tech. */
  caption: string
  columns: readonly LedgerColumn<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  /** Controlled sort. Omit both to let the ledger keep its own, starting from `defaultSort`. */
  sort?: LedgerSort | null
  onSortChange?: (sort: LedgerSort) => void
  defaultSort?: LedgerSort | null
  /** The row shown on `accent-wash`. */
  selectedKey?: string | null
  /** Makes rows activatable with a click, Enter or Space. */
  onRowActivate?: (row: T) => void
  onRowHover?: (row: T | null) => void
  /** Accessible name of an activatable row. */
  rowLabel?: (row: T) => string
  /** Shown in place of the body when there are no rows. */
  empty?: ReactNode
  className?: string
}

/**
 * Signature element 2: a data table with 1px hairline rows (40px, 48px on touch), no zebra and
 * no boxes. Headers are sticky small-caps labels on a rule; figures are mono, right-aligned and
 * tabular; hovering a row nudges it 2px.
 */
export function Ledger<T>({
  caption,
  columns,
  rows,
  rowKey,
  sort: controlledSort,
  onSortChange,
  defaultSort = null,
  selectedKey = null,
  onRowActivate,
  onRowHover,
  rowLabel,
  empty,
  className,
}: LedgerProps<T>) {
  const [ownSort, setOwnSort] = useState<LedgerSort | null>(defaultSort)
  const sort = controlledSort !== undefined ? controlledSort : ownSort
  const sortColumn = sort ? columns.find((column) => column.id === sort.column) : undefined
  const shown =
    sort && sortColumn?.sortValue ? sortRows(rows, sortColumn.sortValue, sort.direction) : rows

  const changeSort = (column: LedgerColumn<T>) => {
    const next = nextSort(sort, column.id, Boolean(column.numeric))
    if (controlledSort === undefined) setOwnSort(next)
    onSortChange?.(next)
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowActivate?.(row)
    }
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left text-small text-ink">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-paper">
          <tr className="border-b border-rule">
            {columns.map((column) => {
              const active = sort?.column === column.id
              const headerText = column.unit ? `${column.header}, ${column.unit}` : column.header
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={cn(
                    'label h-10 px-3 align-middle font-medium whitespace-nowrap text-ink-2 first:pl-0 last:pr-0',
                    column.numeric && 'text-right',
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => changeSort(column)}
                      className={cn(
                        'label inline-flex h-8 items-center gap-1 text-ink-2 hover:text-ink',
                        column.numeric && 'flex-row-reverse',
                        active && 'text-ink',
                      )}
                    >
                      {headerText}
                      {active ? (
                        sort?.direction === 'asc' ? (
                          <ArrowUp aria-hidden className="size-3" />
                        ) : (
                          <ArrowDown aria-hidden className="size-3" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    headerText
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="py-6">
                {empty}
              </td>
            </tr>
          ) : (
            shown.map((row) => {
              const key = rowKey(row)
              const selected = key === selectedKey
              const activatable = Boolean(onRowActivate)
              return (
                <tr
                  key={key}
                  aria-selected={activatable ? selected : undefined}
                  aria-label={activatable && rowLabel ? rowLabel(row) : undefined}
                  tabIndex={activatable ? 0 : undefined}
                  onClick={activatable ? () => onRowActivate?.(row) : undefined}
                  onKeyDown={activatable ? (event) => onRowKeyDown(event, row) : undefined}
                  onPointerEnter={onRowHover ? () => onRowHover(row) : undefined}
                  onPointerLeave={onRowHover ? () => onRowHover(null) : undefined}
                  onFocus={onRowHover ? () => onRowHover(row) : undefined}
                  onBlur={onRowHover ? () => onRowHover(null) : undefined}
                  className={cn(
                    'group border-b border-hairline focus-visible:-outline-offset-2',
                    activatable && 'cursor-pointer',
                    selected ? 'bg-accent-wash' : activatable && 'hover:bg-ink/[0.03]',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        'h-10 px-3 align-middle first:pl-0 last:pr-0 pointer-coarse:h-12',
                        column.numeric && 'data text-right whitespace-nowrap',
                        column.className,
                      )}
                    >
                      <span className="inline-block transition-transform duration-[120ms] ease-out group-hover:translate-x-[2px]">
                        {column.render(row)}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
