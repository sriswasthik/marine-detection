import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from '@/features/observations/api/mockApi'
import { SAMPLE_IDS } from '@/features/observations/mock/samples'
import { resetCommands } from '@/lib/commandBus'
import { routes } from '@/test/routes'

const OPTS = { timeout: 5000 }

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders api={createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0] })}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, user: userEvent.setup() }
}

const palette = () => screen.getByRole('dialog', { name: 'Command palette' })
const search = () => screen.getByRole('combobox', { name: /Search pages, observations/ })
const options = () => within(screen.getByRole('listbox')).getAllByRole('option')
const activeOption = () => options().find((o) => o.getAttribute('aria-selected') === 'true')

afterEach(() => {
  window.localStorage.clear()
  resetCommands()
})

describe('command palette', { timeout: 20_000 }, () => {
  it('opens with Ctrl+K, takes focus, and closes with Escape, giving focus back', async () => {
    const { user } = renderAt('/observations')
    await screen.findByRole('heading', { level: 1, name: 'Observations' }, OPTS)
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    skip.focus()

    await user.keyboard('{Control>}k{/Control}')
    expect(palette()).toBeInTheDocument()
    expect(search()).toHaveFocus()

    // Focus is trapped: Tab stays in the search field.
    await user.keyboard('{Tab}')
    expect(search()).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull()
    expect(skip).toHaveFocus()
  })

  it('opens from the top bar hint too', async () => {
    const { user } = renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, OPTS)
    await user.click(screen.getByRole('button', { name: 'Open the command palette' }))
    expect(palette()).toBeInTheDocument()
  })

  it('reaches pages, observations and actions', async () => {
    const { user } = renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, OPTS)
    await user.keyboard('{Meta>}k{/Meta}')
    const labels = options().map((o) => o.textContent ?? '')
    for (const text of [
      'Overview',
      'Observations',
      'Settings',
      'Analyze new imagery',
      'Fit to detections',
      'Toggle density',
      'Export GeoJSON',
      'Open settings',
      'Show shortcuts',
    ]) {
      expect(
        labels.some((l) => l.includes(text)),
        text,
      ).toBe(true)
    }
    expect(await screen.findByRole('option', { name: /Mahim Bay/ }, OPTS)).toBeInTheDocument()
  })

  it('finds an observation by fuzzy search and opens it with the keyboard only', async () => {
    const { router, user } = renderAt('/')
    await screen.findByRole('heading', { level: 1 }, OPTS)
    await screen.findByRole('link', { name: /Open the map for/ }, OPTS)
    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('mhm b')
    expect(activeOption()).toHaveTextContent('Mahim Bay')
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull()
    expect(router.state.location.pathname).toBe(`/observations/${SAMPLE_IDS.mahim}`)
  })

  it('moves with the arrow keys and wraps around', async () => {
    const { user } = renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, OPTS)
    await user.keyboard('{Control>}k{/Control}')
    const first = activeOption()
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).not.toBe(first)
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(activeOption()).toBe(options().at(-1))
    expect(search()).toHaveAttribute('aria-activedescendant', activeOption()?.id)
  })

  it('says so when nothing matches', async () => {
    const { user } = renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, OPTS)
    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('zzqx')
    expect(within(palette()).getByRole('status')).toHaveTextContent('Nothing matches')
  })

  it('lists recent picks first the next time', async () => {
    const { router, user } = renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, OPTS)
    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('show shortcuts{Enter}')
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.keyboard('{Control>}k{/Control}')
    expect(options()[0]).toHaveTextContent('Show shortcuts')
    expect(screen.getByText('Recent')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('opens the map first for a map action', async () => {
    const { router, user } = renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, OPTS)
    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('fit to det{Enter}')
    expect(router.state.location.pathname).toMatch(/^\/map\//)
  })
})
