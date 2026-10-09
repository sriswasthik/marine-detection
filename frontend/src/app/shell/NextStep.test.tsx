import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NextStep } from './NextStep'

function renderStep(element: React.ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '*', element: <p>Arrived</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('NextStep', () => {
  it.each([
    ['overview', 'Next: open the map', '/map/obs-1'],
    ['map', 'Next: view evidence', '/observations/obs-1'],
    ['detail', 'Next: export the report', '/observations/obs-1/report'],
    ['report', 'Next: back to all observations', '/observations'],
  ] as const)('on %s it links to the next screen', async (page, label, path) => {
    const router = renderStep(<NextStep page={page} observationId="obs-1" />)
    const nav = screen.getByRole('navigation', { name: 'Next step' })
    const link = screen.getByRole('link', { name: label })
    expect(nav).toContainElement(link)
    expect(link).toHaveAttribute('href', path)
    await userEvent.setup().click(link)
    expect(router.state.location.pathname).toBe(path)
    expect(screen.getByText('Arrived')).toBeInTheDocument()
  })

  it('is a tertiary text link with an arrow, not a button', () => {
    renderStep(<NextStep page="settings" observationId={null} />)
    const link = screen.getByRole('link', { name: 'Next: back to the overview' })
    expect(link).toHaveClass('text-accent-ink')
    expect(link.querySelector('svg')).not.toBeNull()
  })
})
