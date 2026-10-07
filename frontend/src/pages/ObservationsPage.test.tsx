import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/router'
import { createMockApi } from '@/features/observations/api/mockApi'
import { getMockScenario, setMockScenario } from '@/features/observations/mock/scenario'

function renderList(path = '/observations') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders api={createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0] })}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, user: userEvent.setup() }
}

const OPTS = { timeout: 5000 }

async function table() {
  return screen.findByRole('table', { name: /^Observations/ }, OPTS)
}

/** Region names in row order. */
function regions(t: HTMLElement): string[] {
  const [, body] = within(t).getAllByRole('rowgroup')
  return within(body as HTMLElement)
    .getAllByRole('row')
    .map((row) => row.getAttribute('aria-label')?.split(',')[0] ?? '')
}

afterEach(() => setMockScenario(null))

describe('Observations page', { timeout: 20_000 }, () => {
  it('lists every observation newest first with all the columns', async () => {
    renderList()
    const t = await table()
    expect(regions(t)).toEqual([
      'Ennore coast',
      'Mahim Bay',
      'Vembanad Lake',
      'Gulf of Mannar',
      'Visakhapatnam coast',
      'Sundarbans delta',
    ])
    for (const column of [
      'Region',
      'Source',
      'Captured',
      'Status',
      'Density',
      'Coverage',
      'Detections',
      'Confidence',
    ]) {
      expect(within(t).getByRole('columnheader', { name: new RegExp(column) })).toBeInTheDocument()
    }
    expect(within(t).getAllByRole('link', { name: /Open detail for/ })).toHaveLength(6)
    expect(within(t).getAllByRole('link', { name: /on the map/ })).toHaveLength(6)
    expect(within(t).getAllByRole('button', { name: /^Export / })).toHaveLength(6)
  })

  it('searches by region and keeps the search in the URL', async () => {
    const { router, user } = renderList()
    await table()
    await user.type(screen.getByRole('searchbox', { name: 'Search by region' }), 'bengal')
    await screen.findByText('3 of 6 observations', {}, OPTS)
    expect(regions(await table())).toEqual([
      'Ennore coast',
      'Visakhapatnam coast',
      'Sundarbans delta',
    ])
    expect(router.state.location.search).toBe('?q=bengal')
  })

  it('filters by source, status and density, and sorts every column', async () => {
    const { router, user } = renderList()
    const t = await table()
    await user.click(screen.getByRole('radio', { name: 'Drone' }))
    expect(regions(await table())).toEqual(['Mahim Bay'])
    await user.click(screen.getByRole('radio', { name: 'All' }))

    await user.click(
      within(screen.getByRole('group', { name: 'Status' })).getByRole('button', {
        name: 'Partial',
      }),
    )
    expect(regions(await table())).toEqual(['Sundarbans delta'])
    await user.click(
      within(screen.getByRole('group', { name: 'Status' })).getByRole('button', {
        name: 'Partial',
      }),
    )

    await user.click(
      within(screen.getByRole('group', { name: 'Density level' })).getByRole('button', {
        name: 'No debris',
      }),
    )
    expect(regions(await table())).toEqual(['Gulf of Mannar'])
    await user.click(
      within(screen.getByRole('group', { name: 'Density level' })).getByRole('button', {
        name: 'No debris',
      }),
    )

    const detections = within(t).getByRole('columnheader', { name: /Detections/ })
    await user.click(within(detections).getByRole('button'))
    expect(detections).toHaveAttribute('aria-sort', 'descending')
    expect(regions(await table())[0]).toBe('Ennore coast')
    expect(router.state.location.search).toBe('?sort=detections&dir=desc')

    const region = within(t).getByRole('columnheader', { name: /Region/ })
    await user.click(within(region).getByRole('button'))
    expect(regions(await table())[0]).toBe('Ennore coast')
    await user.click(within(region).getByRole('button'))
    expect(region).toHaveAttribute('aria-sort', 'descending')
    expect(regions(await table())[0]).toBe('Visakhapatnam coast')
  })

  it('restores filters and sort from the URL', async () => {
    renderList('/observations?src=satellite&sort=coverage&dir=desc')
    expect(regions(await table())[0]).toBe('Ennore coast')
    expect(screen.getByRole('radio', { name: 'Satellite' })).toBeChecked()
    expect(screen.queryByRole('cell', { name: /Mahim/ })).not.toBeInTheDocument()
  })

  it('shows a filtered-empty state with Reset', async () => {
    const { router, user } = renderList('/observations?src=drone&lv=critical')
    expect(
      await screen.findByRole('heading', { name: 'No observations match these filters' }, OPTS),
    ).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Reset filters' }).at(-1) as HTMLElement)
    expect(router.state.location.search).toBe('')
    expect(regions(await table())).toHaveLength(6)
  })

  it('moves between rows with the arrow keys and opens one with Enter', async () => {
    const { router, user } = renderList()
    const t = await table()
    const [, body] = within(t).getAllByRole('rowgroup')
    const rows = within(body as HTMLElement).getAllByRole('row')
    rows[0]?.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(rows[2]).toHaveFocus()
    await user.keyboard('{End}')
    expect(rows[5]).toHaveFocus()
    await user.keyboard('{Home}{Enter}')
    expect(router.state.location.pathname).toBe('/observations/obs-ennore-20261003')
  })

  it('offers to load the sample scenes when there are no observations', async () => {
    setMockScenario('empty')
    const { user } = renderList()
    expect(
      await screen.findByRole('heading', { name: 'No observations yet' }, OPTS),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load sample scenes' }))
    expect(getMockScenario()).toBe('success')
    expect(regions(await table())).toHaveLength(6)
  })
})
