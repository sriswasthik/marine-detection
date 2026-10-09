import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ArrowLink } from '../ArrowLink'
import { Button } from '../Button'
import { buttonStyles, type ButtonVariant } from '../buttonStyles'

describe('Button', () => {
  it('fills only the primary with the accent', () => {
    const variants: ButtonVariant[] = ['primary', 'secondary', 'tertiary', 'ghost', 'danger-quiet']
    for (const variant of variants) {
      const classes = buttonStyles({ variant }).split(' ')
      expect(classes.includes('bg-accent'), variant).toBe(variant === 'primary')
    }
  })

  it('draws the secondary as a 1px ink outline with no fill', () => {
    const classes = buttonStyles({ variant: 'secondary' }).split(' ')
    expect(classes).toEqual(expect.arrayContaining(['border', 'border-ink', 'text-ink']))
    expect(classes.some((c) => c.startsWith('bg-') && !c.startsWith('bg-hairline'))).toBe(false)
  })

  it('draws the tertiary as an accent text link with a trailing arrow and no padding', () => {
    render(<Button variant="tertiary">View evidence</Button>)
    const button = screen.getByRole('button', { name: 'View evidence' })
    expect(button).toHaveClass('text-accent-ink')
    expect(button.className).not.toMatch(/\bpx-\d/)
    expect(button.lastElementChild?.tagName.toLowerCase()).toBe('svg')
  })

  it('leaves the arrow out when iconEnd is null', () => {
    render(
      <Button variant="tertiary" iconEnd={null}>
        Reset
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Reset' }).querySelector('svg')).toBeNull()
  })

  it('makes the quiet danger an outline with danger text', () => {
    expect(buttonStyles({ variant: 'danger-quiet' }).split(' ')).toEqual(
      expect.arrayContaining(['border', 'text-danger']),
    )
  })

  it('never rounds into a pill', () => {
    for (const variant of ['primary', 'secondary', 'tertiary'] as const) {
      const classes = buttonStyles({ variant })
      expect(classes).toContain('rounded-control')
      expect(classes).not.toContain('rounded-full')
    }
  })

  it('blocks clicks and says it is busy while loading, keeping its label', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" loading onClick={onClick}>
        Run detection
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Run detection' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.setup().click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('gives phones a 40px target', () => {
    expect(buttonStyles({ size: 'sm' })).toContain('max-sm:h-10')
    expect(buttonStyles({ size: 'md' })).toContain('max-sm:h-10')
  })
})

describe('ArrowLink', () => {
  it('is a tertiary link with an arrow', () => {
    render(
      <MemoryRouter>
        <ArrowLink to="/map">Next: open the map</ArrowLink>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Next: open the map' })
    expect(link).toHaveAttribute('href', '/map')
    expect(link).toHaveClass('text-accent-ink')
    expect(link.querySelector('svg')).not.toBeNull()
  })
})
