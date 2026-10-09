/** Sorting for ledgers (tables): stable, empty values last in either direction. */

export type SortDirection = 'asc' | 'desc'

export interface LedgerSort {
  column: string
  direction: SortDirection
}

export type SortValue = number | string | null | undefined

function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

const isEmpty = (value: SortValue) =>
  value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))

/** A sorted copy. Rows with equal values keep their order; empty values always go last. */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => SortValue,
  direction: SortDirection,
): T[] {
  const sign = direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, key: value(row) }))
    .sort((a, b) => {
      const aEmpty = isEmpty(a.key)
      const bEmpty = isEmpty(b.key)
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1
      return sign * compareValues(a.key, b.key) || a.index - b.index
    })
    .map((entry) => entry.row)
}

/**
 * The sort after a header click: a new column starts in its natural direction (figures largest
 * first, text A to Z); the same column flips.
 */
export function nextSort(current: LedgerSort | null, column: string, numeric: boolean): LedgerSort {
  if (current?.column === column) {
    return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { column, direction: numeric ? 'desc' : 'asc' }
}
