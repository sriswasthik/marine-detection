import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'

type View = 'map' | 'split' | 'image' | 'table'

const OPTIONS: SegmentedOption<View>[] = [
  { value: 'map', label: 'Map' },
  { value: 'split', label: 'Split' },
  { value: 'image', label: 'Image', disabled: true },
  { value: 'table', label: 'Table' },
]

function Harness({ initial = 'map' }: { initial?: View }) {
  const [value, setValue] = useState<View>(initial)
  return <SegmentedControl label="View" options={OPTIONS} value={value} onChange={setValue} />
}

const radio = (name: string) => screen.getByRole('radio', { name })

describe('SegmentedControl', () => {
  it('is a labelled radio group with one tab stop on the selected option', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument()
    expect(radio('Map')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Map')).toHaveAttribute('tabindex', '0')
    expect(radio('Split')).toHaveAttribute('tabindex', '-1')
  })

  it('moves and selects with arrow keys, skipping disabled options and wrapping', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab()
    expect(radio('Map')).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(radio('Split')).toHaveFocus()
    expect(radio('Split')).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowRight}')
    expect(radio('Table')).toHaveFocus()
    expect(radio('Image')).toHaveAttribute('aria-checked', 'false')

    await user.keyboard('{ArrowRight}')
    expect(radio('Map')).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(radio('Table')).toHaveAttribute('aria-checked', 'true')
  })

  it('jumps with Home and End', async () => {
    const user = userEvent.setup()
    render(<Harness initial="split" />)
    await user.tab()
    await user.keyboard('{End}')
    expect(radio('Table')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Home}')
    expect(radio('Map')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Map')).toHaveFocus()
  })

  it('selects on click', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(radio('Table'))
    expect(radio('Table')).toHaveAttribute('aria-checked', 'true')
  })
})
