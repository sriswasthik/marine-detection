import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DropdownMenu } from '../DropdownMenu'

function setup() {
  const onGeojson = vi.fn()
  const onCsv = vi.fn()
  render(
    <DropdownMenu
      items={[
        { id: 'geojson', label: 'GeoJSON', onSelect: onGeojson },
        { id: 'pdf', label: 'PDF', disabled: true, onSelect: () => {} },
        { type: 'separator', id: 'sep' },
        { id: 'csv', label: 'CSV', onSelect: onCsv },
      ]}
      trigger={(props) => (
        <button type="button" {...props}>
          Export
        </button>
      )}
    />,
  )
  return { onGeojson, onCsv, trigger: screen.getByRole('button', { name: 'Export' }) }
}

describe('DropdownMenu', () => {
  it('opens from the keyboard on the first item and skips disabled items', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'GeoJSON' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'CSV' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'GeoJSON' })).toHaveFocus()
  })

  it('selects with Enter, closes and returns focus', async () => {
    const user = userEvent.setup()
    const { trigger, onCsv } = setup()
    trigger.focus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'CSV' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onCsv).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('closes on Escape and on outside click', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
