import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createMockApi } from '@/features/observations/api/mockApi'
import { SAMPLE_IDS } from '@/features/observations/mock/samples'
import { AppProviders } from './providers'
import { routes } from './router'

/** These tests use the real lazy routes; the first import of a page can take a moment. */
const LAZY = { timeout: 5000 }

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

describe('app shell', { timeout: 15_000 }, () => {
  it('renders the overview inside the shell with a skip link', async () => {
    renderAt('/')
    expect(
      await screen.findByRole(
        'heading',
        {
          level: 1,
          name: 'See floating marine debris from orbit, and know where to clean up first.',
        },
        LAZY,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('link', { name: /A\.W\.A\.R\.E\./ })).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: /Analyze new imagery/ })) {
      expect(link).toHaveAttribute('href', '/analyze')
    }
  })

  it('marks the active navigation link', async () => {
    renderAt('/observations')
    await screen.findByRole('heading', { level: 1, name: 'Observations' }, LAZY)
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
    ['/compare', 'Temporal Comparison'],
  ])('routes %s to its page', async (path, title) => {

    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title }, LAZY)).toBeInTheDocument()
  })

  it('shows a 404 page for unknown paths', async () => {
    renderAt('/does-not-exist')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('keeps the top bar to navigation and the one action: no data source tag, no switcher', async () => {
    renderAt('/observations')
    await screen.findByRole('heading', { level: 1, name: 'Observations' }, LAZY)
    const topBar = screen.getAllByRole('banner')[0] as HTMLElement
    expect(within(topBar).queryByText('Sample data')).toBeNull()
    expect(within(topBar).queryByRole('button', { name: /Current observation/ })).toBeNull()
    // The wordmark alone: the full name is for the Overview only.
    expect(within(topBar).getByText('A.W.A.R.E.')).toBeInTheDocument()
    expect(within(topBar).queryByText('AI Waste Analysis & Reconnaissance Engine')).toBeNull()

    cleanup()
    renderAt('/')
    await screen.findByRole('heading', { level: 1 }, LAZY)
    const overviewBar = screen.getAllByRole('banner')[0] as HTMLElement
    expect(
      within(overviewBar).getByText('AI Waste Analysis & Reconnaissance Engine'),
    ).toBeInTheDocument()
  })

  it('switches observation from the More sheet and keeps the page type', async () => {
    const user = userEvent.setup()
    const router = renderAt(`/observations/${SAMPLE_IDS.ennore}`)
    const tabs = await screen.findByRole('navigation', { name: 'Sections' }, LAZY)
    await user.click(within(tabs).getByRole('button', { name: 'More' }))
    const sheet = screen.getByRole('dialog', { name: 'More' })
    await user.click(await within(sheet).findByRole('button', { name: /Current observation/ }))
    await user.click(screen.getByRole('menuitemradio', { name: /Mahim Bay/ }))
    expect(router.state.location.pathname).toBe(`/observations/${SAMPLE_IDS.mahim}`)
  })

  it('has a tab bar for phones whose More button opens the rest in a sheet', async () => {
    const user = userEvent.setup()
    renderAt('/')
    // Pages load lazily: wait for the shell to replace the loading frame.
    const tabs = await screen.findByRole('navigation', { name: 'Sections' }, LAZY)
    for (const name of ['Overview', 'Analyze', 'Map', 'Observations']) {
      expect(within(tabs).getByRole('link', { name })).toBeInTheDocument()
    }
    await user.click(within(tabs).getByRole('button', { name: 'More' }))
    const sheet = screen.getByRole('dialog', { name: 'More' })
    expect(within(sheet).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('carries the primary action in the top bar, except on Analyze, which owns Run detection', async () => {
    renderAt('/observations')
    await screen.findByRole('heading', { level: 1, name: 'Observations' }, LAZY)
    // The top bar is the first banner (page headers can count too).
    const topBar = () => screen.getAllByRole('banner')[0] as HTMLElement
    expect(within(topBar()).getByRole('link', { name: 'Analyze new imagery' })).toHaveAttribute(
      'href',
      '/analyze',
    )

    cleanup()
    renderAt('/analyze')
    await screen.findByRole('heading', { level: 1, name: 'Analyze new imagery' }, LAZY)
    expect(within(topBar()).queryByRole('link', { name: 'Analyze new imagery' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Run detection' })).toBeInTheDocument()
  })

  it('shows breadcrumbs on deep pages and a next step at the end', async () => {
    renderAt(`/observations/${SAMPLE_IDS.ennore}/report`)
    await screen.findByRole('heading', { level: 1, name: /Ennore coast/ }, LAZY)
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByRole('link', { name: 'Observations' })).toHaveAttribute(
      'href',
      '/observations',
    )
    expect(within(crumbs).getByText('Report')).toHaveAttribute('aria-current', 'page')
    const next = screen.getByRole('navigation', { name: 'Next step' })
    expect(within(next).getByRole('link')).toHaveAttribute('href', '/observations')
  })
})

describe('keyboard shortcuts', () => {
  it('"?" opens the shortcuts dialog, Esc closes it and focus returns', async () => {
    const user = userEvent.setup()
    renderAt('/observations')
    await screen.findByRole('heading', { level: 1, name: 'Observations' }, LAZY)
    const search = await screen.findByRole('searchbox', { name: 'Search by region' }, LAZY)
    // Typing "?" in a field types it; it does not open the dialog.
    await user.type(search, '?')
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull()
    await user.clear(search)

    const link = screen.getByRole('link', { name: 'Skip to content' })
    link.focus()
    await user.keyboard('?')
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(dialog).toHaveTextContent('Fit the map to the detections')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull()
    expect(link).toHaveFocus()
  })
})
