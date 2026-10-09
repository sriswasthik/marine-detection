import { describe, expect, it } from 'vitest'
import { nextSort, sortRows } from './ledger'

const rows = [
  { id: 'a', area: 30, name: 'Mahim' },
  { id: 'b', area: null, name: 'Ennore' },
  { id: 'c', area: 120, name: 'Vembanad' },
  { id: 'd', area: 30, name: 'ennore 2' },
]

describe('sortRows', () => {
  it('sorts figures both ways, keeping equal values in their order', () => {
    expect(sortRows(rows, (r) => r.area, 'asc').map((r) => r.id)).toEqual(['a', 'd', 'c', 'b'])
    expect(sortRows(rows, (r) => r.area, 'desc').map((r) => r.id)).toEqual(['c', 'a', 'd', 'b'])
  })

  it('puts empty values last in either direction', () => {
    expect(sortRows(rows, (r) => r.area, 'asc').at(-1)?.id).toBe('b')
    expect(sortRows(rows, (r) => r.area, 'desc').at(-1)?.id).toBe('b')
  })

  it('sorts text without regard to case, with numbers in natural order', () => {
    expect(sortRows(rows, (r) => r.name, 'asc').map((r) => r.id)).toEqual(['b', 'd', 'a', 'c'])
    const labels = [{ v: 'Hotspot 10' }, { v: 'Hotspot 2' }]
    expect(sortRows(labels, (r) => r.v, 'asc').map((r) => r.v)).toEqual(['Hotspot 2', 'Hotspot 10'])
  })

  it('does not change the input', () => {
    const copy = [...rows]
    sortRows(rows, (r) => r.area, 'desc')
    expect(rows).toEqual(copy)
  })
})

describe('nextSort', () => {
  it('starts figures largest first and text A to Z, and flips the same column', () => {
    expect(nextSort(null, 'area', true)).toEqual({ column: 'area', direction: 'desc' })
    expect(nextSort(null, 'name', false)).toEqual({ column: 'name', direction: 'asc' })
    expect(nextSort({ column: 'area', direction: 'desc' }, 'area', true)).toEqual({
      column: 'area',
      direction: 'asc',
    })
  })
})
