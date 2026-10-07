import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createMockApi } from '@/features/observations/api/mockApi'
import { SAMPLE_IDS } from '@/features/observations/mock/samples'
import { AppProviders } from './providers'
import { routes } from './router'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const api = createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0], scenario: () => 'success' })
  render(
    <AppProviders api={api}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

describe('app shell', () => {
  it('renders the overview inside the shell with a skip link', async () => {
    renderAt('/')
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Detect marine debris and understand exactly where it is.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('link', { name: /Marine Waste Intelligence/ })).toBeInTheDocument()
    expect(screen.getByText('Sample data')).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: /Analyze new imagery/ })) {
      expect(link).toHaveAttribute('href', '/analyze')
    }
  })

  it('marks the active navigation link', async () => {
    renderAt('/observations')
    await screen.findByRole('heading', { level: 1, name: 'Observations' })
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('Observations')
  })

  it.each([
    ['/analyze', 'Analyze new imagery'],
    ['/map', 'Map'],
    [`/map/${SAMPLE_IDS.ennore}`, 'Map'],
    [`/observations/${SAMPLE_IDS.ennore}`, 'Ennore coast, Bay of Bengal'],
    [`/observations/${SAMPLE_IDS.ennore}/report`, 'Ennore coast, Bay of Bengal'],
    ['/settings', 'Settings'],
    ['/compare', 'Compare'],
  ])('routes %s to its page', async (path, title) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown paths', async () => {
    renderAt('/does-not-exist')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('switches observation from the chip and keeps the page type', async () => {
    const user = userEvent.setup()
    const router = renderAt(`/observations/${SAMPLE_IDS.ennore}`)
    const chips = await screen.findAllByRole('button', { name: /Current observation/ })
    const chip = chips[0]
    if (!chip) throw new Error('Observation chip missing')
    await user.click(chip)
    await user.click(screen.getByRole('menuitemradio', { name: /Mahim Bay/ }))
    expect(router.state.location.pathname).toBe(`/observations/${SAMPLE_IDS.mahim}`)
  })

  it('opens the mobile menu sheet', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
  })
})
