import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { DENSITY_LEVELS } from '@/lib/density'
import { SeverityBadge } from '../SeverityBadge'

describe('SeverityBadge', () => {
  it.each(DENSITY_LEVEL_IDS)('always shows a text label for %s', (level) => {
    const { container } = render(<SeverityBadge level={level} />)
    expect(screen.getByText(DENSITY_LEVELS[level].label)).toBeVisible()
    expect(container.textContent).toContain(DENSITY_LEVELS[level].label)
  })

  it.each(DENSITY_LEVEL_IDS)('keeps the label in the plain variant for %s', (level) => {
    render(<SeverityBadge level={level} variant="plain" />)
    expect(screen.getByText(DENSITY_LEVELS[level].label)).toBeInTheDocument()
  })

  it('hides the colour swatch from assistive tech', () => {
    const { container } = render(<SeverityBadge level="critical" />)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('can show the one-line meaning', () => {
    render(<SeverityBadge level="critical" showMeaning />)
    expect(screen.getByText(/Priority hotspot/)).toBeInTheDocument()
  })
})
