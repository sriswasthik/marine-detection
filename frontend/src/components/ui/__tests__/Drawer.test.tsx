import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Drawer } from '../Drawer'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open details
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Detection details">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Drawer>
    </>
  )
}

const focusedElement = () => document.activeElement as HTMLElement

describe('Drawer', () => {
  it('opens as a labelled dialog and moves focus into it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open details' }))
    const dialog = screen.getByRole('dialog', { name: 'Detection details' })
    expect(dialog).toContainElement(focusedElement())
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open details' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('closes from the close button and returns focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open details' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('keeps Tab inside the drawer', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open details' }))
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 5; i++) {
      await user.tab()
      expect(dialog).toContainElement(focusedElement())
    }
    await user.tab({ shift: true })
    expect(dialog).toContainElement(focusedElement())
  })

  it('opens the mobile sheet at half height; the handle expands it, and reopening resets it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open details' })
    await user.click(trigger)
    const handle = screen.getByRole('button', { name: 'Show more of the panel' })
    expect(handle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog')).toHaveClass('max-h-[50dvh]')
    await user.click(handle)
    expect(screen.getByRole('button', { name: 'Show less of the panel' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('dialog')).toHaveClass('max-h-[85dvh]')
    await user.keyboard('{Escape}')
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Show more of the panel' })).toBeInTheDocument()
  })
})
