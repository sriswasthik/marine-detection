import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Figure, THIN_SPACE } from '../Figure'
import { Sentence, SentenceFigure } from '../Sentence'
import { resetCountUp } from '../useCountUp'

afterEach(() => {
  resetCountUp()
  vi.restoreAllMocks()
})

describe('Figure', () => {
  it('formats the value and sets the unit after a thin space, smaller and in ink-2', () => {
    const { container } = render(<Figure value={3.4123} format={(v) => v.toFixed(1)} unit="ha" />)
    expect(container.textContent).toBe(`3.4${THIN_SPACE}ha`)
    expect(screen.getByText('3.4')).toHaveClass('num', 'text-figure')
    expect(screen.getByText('ha', { exact: false })).toHaveClass('text-ink-2', 'text-title')
  })

  it('scales the unit with the figure: 56 with 22, 32 with 13', () => {
    render(<Figure value={42} unit="regions" size="page" />)
    expect(screen.getByText('42')).toHaveClass('text-page')
    expect(screen.getByText('regions', { exact: false })).toHaveClass('text-small')
  })

  it('aligns the unit on the baseline', () => {
    const { container } = render(<Figure value={1} unit="ha" />)
    expect(container.firstElementChild).toHaveClass('items-baseline')
  })

  it('rounds by default and shows a dash, without a unit, for no value', () => {
    const { container, rerender } = render(<Figure value={41.6} />)
    expect(container.textContent).toBe('42')
    rerender(<Figure value={null} unit="ha" />)
    expect(container.textContent).toBe('–')
  })

  it('counts up once per key, giving assistive tech the final value only', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
    } as MediaQueryList)
    let frame: FrameRequestCallback | null = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frame = cb
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const start = performance.now()
    vi.spyOn(performance, 'now').mockReturnValue(start)

    const { container, unmount } = render(<Figure value={42} countUpKey="obs-1:regions" />)
    expect(screen.getByText('42')).toHaveClass('sr-only')
    act(() => frame?.(start + 1000))
    expect(container.textContent).toBe('42')
    expect(screen.getByText('42')).not.toHaveClass('sr-only')
    unmount()

    // Seen in this session: no second count-up.
    render(<Figure value={42} countUpKey="obs-1:regions" />)
    expect(screen.getByText('42')).not.toHaveClass('sr-only')
  })

  it('does not count up under reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    render(<Figure value={7} countUpKey="obs-2:hotspots" />)
    expect(screen.getByText('7')).not.toHaveClass('sr-only')
  })
})

describe('Sentence', () => {
  it('writes the result as a sentence with the numbers set large inside it', () => {
    const { container } = render(
      <Sentence>
        <SentenceFigure value={42} /> possible debris regions covering{' '}
        <SentenceFigure value={3.4} format={(v) => v.toFixed(1)} unit="ha" />.
      </Sentence>,
    )
    expect(container.querySelector('p')).toHaveClass('text-lead')
    expect(container.textContent).toBe(`42 possible debris regions covering 3.4${THIN_SPACE}ha.`)
    expect(screen.getByText('42')).toHaveClass('text-figure')
  })

  it('uses the page size in tight spaces', () => {
    render(
      <Sentence size="page">
        <SentenceFigure value={3} /> hotspots
      </Sentence>,
    )
    expect(screen.getByText('3')).toHaveClass('text-page')
  })
})
