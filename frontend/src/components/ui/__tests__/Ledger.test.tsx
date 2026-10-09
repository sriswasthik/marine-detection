import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Ledger, type LedgerColumn } from '../Ledger'

interface Row {
  id: string
  region: string
  area: number
}

const rows: Row[] = [
  { id: 'a', region: 'Mahim', area: 30 },
  { id: 'b', region: 'Ennore', area: 120 },
  { id: 'c', region: 'Vembanad', area: 4 },
]

const columns: LedgerColumn<Row>[] = [
  { id: 'region', header: 'Region', render: (r) => r.region, sortValue: (r) => r.region },
  {
    id: 'area',
    header: 'Area',
    unit: 'ha',
    numeric: true,
    render: (r) => r.area,
    sortValue: (r) => r.area,
  },
]

const bodyText = () =>
  within(screen.getAllByRole('rowgroup')[1] as HTMLElement)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent)

describe('Ledger', () => {
  it('puts units in the header, not in the cells', () => {
    render(<Ledger caption="Hotspots" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    expect(screen.getByRole('columnheader', { name: /Area, ha/ })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '120' })).toBeInTheDocument()
  })

  it('sets figures in mono, right-aligned, and text left-aligned', () => {
    render(<Ledger caption="Hotspots" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    const figure = screen.getByRole('cell', { name: '120' })
    expect(figure).toHaveClass('data', 'text-right')
    expect(screen.getByRole('columnheader', { name: /Area/ })).toHaveClass('text-right')
    expect(screen.getByRole('cell', { name: 'Ennore' })).not.toHaveClass('text-right')
  })

  it('sorts on a header click: figures largest first, then flips; text A to Z', async () => {
    const user = userEvent.setup()
    render(<Ledger caption="Hotspots" columns={columns} rows={rows} rowKey={(r) => r.id} />)
    expect(bodyText()).toEqual(['Mahim', 'Ennore', 'Vembanad'])

    await user.click(screen.getByRole('button', { name: /Area/ }))
    expect(bodyText()).toEqual(['Ennore', 'Mahim', 'Vembanad'])
    expect(screen.getByRole('columnheader', { name: /Area/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )

    await user.click(screen.getByRole('button', { name: /Area/ }))
    expect(bodyText()).toEqual(['Vembanad', 'Mahim', 'Ennore'])
    expect(screen.getByRole('columnheader', { name: /Area/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    await user.click(screen.getByRole('button', { name: /Region/ }))
    expect(bodyText()).toEqual(['Ennore', 'Mahim', 'Vembanad'])
  })

  it('reports sort changes when controlled, without sorting on its own', async () => {
    const onSortChange = vi.fn()
    render(
      <Ledger
        caption="Hotspots"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sort={null}
        onSortChange={onSortChange}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /Area/ }))
    expect(onSortChange).toHaveBeenCalledWith({ column: 'area', direction: 'desc' })
    expect(bodyText()).toEqual(['Mahim', 'Ennore', 'Vembanad'])
  })

  it('activates rows with a click or the keyboard and marks the selected one', async () => {
    const user = userEvent.setup()
    const onRowActivate = vi.fn()
    render(
      <Ledger
        caption="Hotspots"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        selectedKey="b"
        onRowActivate={onRowActivate}
        rowLabel={(r) => r.region}
      />,
    )
    const ennore = screen.getByRole('row', { name: 'Ennore' })
    expect(ennore).toHaveAttribute('aria-selected', 'true')
    expect(ennore).toHaveClass('bg-accent-wash')
    await user.click(screen.getByRole('row', { name: 'Mahim' }))
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0])
    screen.getByRole('row', { name: 'Vembanad' }).focus()
    await user.keyboard('{Enter}')
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[2])
  })

  it('shows its empty state instead of a bare body', () => {
    render(
      <Ledger
        caption="Hotspots"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty={<p>No hotspots</p>}
      />,
    )
    expect(screen.getByText('No hotspots')).toBeInTheDocument()
  })
})
