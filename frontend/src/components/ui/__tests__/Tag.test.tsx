import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import { DENSITY_LEVELS } from '@/lib/density'
import { ConfidenceTag, SeverityTag, Tag, type TagTone } from '../Tag'

const TONES: readonly TagTone[] = ['neutral', 'accent', 'success', 'warning', 'danger']

/** The visible text of a tag, without the swatch (which has none). */
const visibleText = (element: Element) =>
  [...element.childNodes]
    .filter((node) => !(node instanceof Element && node.getAttribute('aria-hidden') === 'true'))
    .map((node) => node.textContent ?? '')
    .join('')
    .trim()

describe('Tag', () => {
  it.each(TONES)('always carries its text next to the swatch (%s)', (tone) => {
    const { container } = render(<Tag tone={tone}>Sample data</Tag>)
    const tag = container.firstElementChild
    expect(tag).not.toBeNull()
    expect(visibleText(tag as Element)).toBe('Sample data')
    expect(screen.getByText('Sample data')).toBeVisible()
  })

  it('is squared, not a pill', () => {
    const { container } = render(<Tag tone="warning">Partial</Tag>)
    const tag = container.firstElementChild as HTMLElement
    expect(tag.className).toContain('rounded-tag')
    expect(tag.className).not.toContain('rounded-full')
  })

  it('hides the swatch from assistive tech and leaves it out for neutral tags', () => {
    const { container, rerender } = render(<Tag tone="success">Completed</Tag>)
    expect(container.querySelectorAll('[aria-hidden]')).toHaveLength(1)
    rerender(<Tag tone="neutral">Queued</Tag>)
    expect(container.querySelectorAll('[aria-hidden]')).toHaveLength(0)
  })
})

describe('SeverityTag', () => {
  it.each(DENSITY_LEVEL_IDS)('always shows a text label for %s', (level) => {
    const { container } = render(<SeverityTag level={level} />)
    expect(screen.getByText(DENSITY_LEVELS[level].label)).toBeVisible()
    expect(visibleText(container.firstElementChild as Element)).toBe(DENSITY_LEVELS[level].label)
  })

  it.each(DENSITY_LEVEL_IDS)('keeps the label in the plain variant for %s', (level) => {
    render(<SeverityTag level={level} variant="plain" />)
    expect(screen.getByText(DENSITY_LEVELS[level].label)).toBeInTheDocument()
  })

  it('hides the colour swatch from assistive tech', () => {
    const { container } = render(<SeverityTag level="critical" />)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('can show the one-line meaning', () => {
    render(<SeverityTag level="critical" showMeaning />)
    expect(screen.getByText(/Priority hotspot/)).toBeInTheDocument()
  })
})

describe('ConfidenceTag', () => {
  function bandOf(value: number): string | null {
    const { container, unmount } = render(<ConfidenceTag value={value} />)
    const band = container.querySelector('[data-band]')?.getAttribute('data-band') ?? null
    unmount()
    return band
  }

  it('uses the configured thresholds: High from 0.80, Medium 0.60 to 0.79, Low under 0.60', () => {
    expect(CONFIDENCE_THRESHOLDS).toEqual({ low: 0.6, high: 0.8 })
    expect(bandOf(1)).toBe('high')
    expect(bandOf(0.8)).toBe('high')
    expect(bandOf(0.79)).toBe('medium')
    expect(bandOf(0.6)).toBe('medium')
    expect(bandOf(0.59)).toBe('low')
    expect(bandOf(0)).toBe('low')
  })

  it('shows the band label and the percentage as text', () => {
    render(<ConfidenceTag value={0.87} />)
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('confidence', { exact: false })).toHaveClass('sr-only')
  })

  it('can hide the percentage, never the band label', () => {
    render(<ConfidenceTag value={0.45} showValue={false} />)
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.queryByText('45%')).toBeNull()
  })
})
