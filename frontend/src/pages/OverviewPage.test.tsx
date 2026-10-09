import { QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { routes } from '@/test/routes'
import { networkError } from '@/features/observations/api/errors'
import { createMockApi } from '@/features/observations/api/mockApi'
import type { ObservationsApi } from '@/features/observations/api/types'
import { CurrentObservationProvider } from '@/features/observations/CurrentObservationProvider'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import { analyzeObservation } from '@/lib/analysis'
import { formatArea, formatConfidence, formatCoveragePercent } from '@/lib/format'

const fastMock = () =>
  createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0], scenario: () => 'success' })

function renderOverview(api: ObservationsApi, selectedId?: string, queryClient?: QueryClient) {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] })
  render(
    <AppProviders api={api} queryClient={queryClient}>
      <CurrentObservationProvider initialId={selectedId ?? null}>
        <RouterProvider router={router} />
      </CurrentObservationProvider>
    </AppProviders>,
  )
  return router
}

function hero() {
  const observation = getSampleObservation(SAMPLE_IDS.ennore)
  if (!observation) throw new Error('Hero sample missing')
  return observation
}

/** The four metric cards, keyed by their label. */
async function kpiValues() {
  // The map preview makes this render slower than most; allow for a busy test machine.
  const section = await screen.findByRole(
    'region',
    { name: /Ennore coast|Gulf of Mannar/ },
    { timeout: 5000 },
  )
  const read = (label: string) => {
    // Each figure is a group named by its label.
    return within(section).getByRole('group', { name: label }).textContent ?? ''
  }
  return {
    area: read('Debris area'),
    coverage: read('Coverage'),
    hotspots: read('Hotspots'),
    confidence: read('Average confidence'),
    all: section.textContent ?? '',
  }
}

describe('Overview page', { timeout: 15_000 }, () => {
  it('answers the four questions for the latest observation', async () => {
    renderOverview(fastMock())
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'See floating marine debris from orbit, and know where to clean up first.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'How it works' }).children).toHaveLength(7)

    const kpis = await kpiValues()
    const observation = hero()
    expect(kpis.area).toContain(formatArea(observation.debrisAreaM2))
    expect(kpis.coverage).toContain(formatCoveragePercent(observation.coveragePercent))
    expect(kpis.hotspots).toContain(String(analyzeObservation(observation).hotspots.length))
    expect(kpis.confidence).toContain(formatConfidence(observation.averageConfidence))
    expect(screen.getAllByText('Sample data').length).toBeGreaterThan(0)

    const inspect = screen.getByRole('region', { name: 'Inspect next' })
    const links = within(inspect).getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', `/map/${SAMPLE_IDS.ennore}?h=hotspot-1`)

    expect(
      screen.getByRole('link', { name: `Open the map for ${observation.region}` }),
    ).toHaveAttribute('href', `/map/${SAMPLE_IDS.ennore}`)

    const recent = screen.getByRole('region', { name: /^Recent observations/ })
    expect(within(recent).getAllByRole('listitem')).toHaveLength(5)
    expect(within(recent).getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/observations',
    )
  })

  it('handles a no-debris observation without NaN or empty panels', async () => {
    renderOverview(fastMock(), SAMPLE_IDS.mannar)
    const kpis = await kpiValues()
    expect(kpis.area).toContain('0 m²')
    expect(kpis.coverage).toContain('0%')
    expect(kpis.hotspots).toContain('0')
    expect(kpis.confidence).toContain('—')
    expect(kpis.all).not.toMatch(/NaN|undefined|Infinity/)
    expect(screen.getByText('Nothing to inspect')).toBeInTheDocument()
    expect(screen.getByText('No debris was detected in this observation.')).toBeInTheDocument()
    expect(screen.getByText(/No debris detected in .* of water/)).toBeInTheDocument()
    expect(screen.getByText('Selected observation')).toBeInTheDocument()
  })

  it('shows the low-confidence banner and other caveats at the top', async () => {
    renderOverview(fastMock(), SAMPLE_IDS.visakhapatnam)
    const notices = await screen.findByTestId('observation-notices', {}, { timeout: 5000 })
    expect(within(notices).getByText('Low confidence')).toBeInTheDocument()
    expect(within(notices).getByText(/Cloud covered 41\.0% of the image/)).toBeInTheDocument()
  })

  it('shows no caveat banners for a confident, fully placed result', async () => {
    renderOverview(fastMock(), SAMPLE_IDS.ennore)
    await kpiValues()
    expect(screen.queryByTestId('observation-notices')).not.toBeInTheDocument()
  })

  it('shows an empty state with both actions when there are no observations', async () => {
    const api: ObservationsApi = {
      ...fastMock(),
      listObservations: () => Promise.resolve({ data: [], issues: [] }),
    }
    renderOverview(api)
    expect(await screen.findByRole('heading', { name: 'No observations yet' })).toBeInTheDocument()
    // The top bar carries "Analyze new imagery"; the page offers a sample scene as the way in.
    expect(screen.getAllByRole('link', { name: 'Analyze new imagery' })[0]).toHaveAttribute(
      'href',
      '/analyze',
    )
    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: 'Load a sample scene' })).toHaveAttribute(
      'href',
      '/analyze?sample=1',
    )
  })

  it('shows an error with a working retry', async () => {
    const listObservations = vi.fn<ObservationsApi['listObservations']>(() =>
      Promise.reject(networkError()),
    )
    const api: ObservationsApi = { ...fastMock(), listObservations }
    // No automatic retries, so the error shows at once and only the button retries.
    renderOverview(
      api,
      undefined,
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    )
    expect(await screen.findByText("Can't reach the processing service")).toBeInTheDocument()
    expect(screen.getByText(/Check your connection, then try again/)).toBeInTheDocument()
    const calls = listObservations.mock.calls.length
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(listObservations.mock.calls.length).toBeGreaterThan(calls)
  })

  it('shows a matching skeleton while loading', () => {
    const api: ObservationsApi = {
      ...fastMock(),
      listObservations: () => new Promise(() => {}),
    }
    const { container } = render(
      <AppProviders api={api}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />
      </AppProviders>,
    )
    expect(container.querySelectorAll('.skeleton-pulse').length).toBeGreaterThan(10)
  })
})
