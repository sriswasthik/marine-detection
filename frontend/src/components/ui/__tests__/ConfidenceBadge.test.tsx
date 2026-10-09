import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import { ConfidenceBadge } from '../ConfidenceBadge'

function bandOf(value: number): string | null {
  const { container, unmount } = render(<ConfidenceBadge value={value} />)
  const band = container.querySelector('[data-band]')?.getAttribute('data-band') ?? null
  unmount()
  return band
}

describe('ConfidenceBadge', () => {
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
    render(<ConfidenceBadge value={0.87} />)
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('confidence', { exact: false })).toHaveClass('sr-only')
  })

  it('can hide the percentage', () => {
    render(<ConfidenceBadge value={0.45} showValue={false} />)
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.queryByText('45%')).toBeNull()
  })
})
