/**
 * The state matrix (docs/STATE_MATRIX.md) as tests: every surface renders its loading skeleton,
 * empty state, specific error with retry, offline error, and the result caveats.
 */
import { QueryClient } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/router'
import { networkError } from '@/features/observations/api/errors'
import { createMockApi } from '@/features/observations/api/mockApi'
import { withResilience } from '@/features/observations/api/resilientApi'
import type { ObservationsApi } from '@/features/observations/api/types'
import { CurrentObservationProvider } from '@/features/observations/CurrentObservationProvider'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Observation } from '@/features/observations/types'

const mock = () =>
  createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0], scenario: () => 'success' })

const never = <T,>() => new Promise<T>(() => undefined)

function pendingApi(): ObservationsApi {
  return {
    ...mock(),
    listObservations: () => never(),
    getObservation: () => never(),
    health: () => never(),
  }
}

function failingApi(): ObservationsApi {
  const fail = () => Promise.reject(networkError())
  return { ...mock(), listObservations: fail, getObservation: fail, health: fail }
}

function emptyApi(): ObservationsApi {
  return { ...mock(), listObservations: () => Promise.resolve({ data: [], issues: [] }) }
}

/** Serves the samples, with any of them replaced. */
function apiWith(...replacements: Observation[]): ObservationsApi {
  const base = mock()
  return {
    ...base,
    getObservation: async (id, options) => {
      const replaced = replacements.find((o) => o.id === id)
      return replaced ? { data: replaced, issues: [] } : base.getObservation(id, options)
    },
  }
}

function renderAt(path: string, api: ObservationsApi, selectedId?: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders
      api={api}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CurrentObservationProvider initialId={selectedId ?? null}>
        <RouterProvider router={router} />
      </CurrentObservationProvider>
    </AppProviders>,
  )
}

function sample(id: string): Observation {
  const observation = getSampleObservation(id)
  if (!observation) throw new Error(`missing ${id}`)
  return observation
}

const ennore = SAMPLE_IDS.ennore
const SURFACES = {
  Overview: '/',
  Map: '/map',
  'Observation detail': `/observations/${ennore}`,
  'Observations list': '/observations',
  Settings: '/settings',
  Report: `/observations/${ennore}/report`,
} as const

const LOADING_LABELS: Record<keyof typeof SURFACES, string> = {
  Overview: 'Loading observations',
  Map: 'Loading map',
  'Observation detail': 'Loading observation',
  'Observations list': 'Loading observations',
  Settings: 'Checking the service',
  Report: 'Loading report',
}

const OPTS = { timeout: 5000 }

afterEach(() => vi.restoreAllMocks())

describe('loading', { timeout: 20_000 }, () => {
  it.each(Object.entries(SURFACES))('%s shows its skeleton', async (surface, path) => {
    renderAt(path, pendingApi())
    const label = LOADING_LABELS[surface as keyof typeof SURFACES]
    expect(await screen.findByText(label, {}, OPTS)).toBeInTheDocument()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})

describe('error', { timeout: 20_000 }, () => {
  it.each(Object.entries(SURFACES))(
    '%s explains the failure and offers a retry',
    async (_surface, path) => {
      renderAt(path, failingApi())
      const [heading] = await screen.findAllByRole(
        'heading',
        { name: "Can't reach the processing service" },
        OPTS,
      )
      const alert = heading?.closest('[role="alert"]')
      if (!(alert instanceof HTMLElement)) throw new Error('no alert')
      expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(document.body.textContent).not.toMatch(/Something went wrong|Error:|at \w+ \(/)
    },
  )
})

describe('offline', { timeout: 20_000 }, () => {
  it.each(Object.entries(SURFACES))(
    '%s fails fast with the offline message instead of hanging',
    async (_surface, path) => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      renderAt(path, withResilience(mock(), { isOnline: () => false }))
      expect(
        (await screen.findAllByRole('heading', { name: "You're offline" }, OPTS)).length,
      ).toBeGreaterThan(0)
      // The quiet bar under the top bar says so too.
      expect(screen.getByText(/New requests will fail until you reconnect/)).toBeInTheDocument()
    },
  )

  it('Analyze keeps the form usable but blocks Run detection while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderAt('/analyze?sample=1', mock())
    expect(
      await screen.findByText("You're offline. Reconnect to run detection.", {}, OPTS),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run detection' })).toBeDisabled()
  })
})

describe('empty', { timeout: 20_000 }, () => {
  it.each([
    ['Overview', '/', 'No observations yet'],
    ['Observations list', '/observations', 'No observations yet'],
    ['Map', '/map', 'Nothing to map yet'],
  ])('%s explains there is nothing yet and how to start', async (_surface, path, title) => {
    renderAt(path, emptyApi())
    expect(await screen.findByRole('heading', { name: title }, OPTS)).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(
      within(main).getAllByRole('link', { name: /Analyze new imagery/ }).length,
    ).toBeGreaterThan(0)
  })

  it.each([
    ['Observation detail', '/observations/obs-missing'],
    ['Report', '/observations/obs-missing/report'],
  ])('%s says when the observation does not exist', async (_surface, path) => {
    renderAt(path, mock())
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Observation not found' }, OPTS),
    ).toBeInTheDocument()
  })
})

describe('low confidence', { timeout: 20_000 }, () => {
  const vizag = SAMPLE_IDS.visakhapatnam
  it.each([
    ['Overview', '/', vizag],
    ['Map', `/map/${vizag}`, undefined],
    ['Observation detail', `/observations/${vizag}`, undefined],
    ['Report', `/observations/${vizag}/report`, undefined],
  ])('%s shows the low-confidence banner', async (_surface, path, selected) => {
    renderAt(path, mock(), selected)
    const notices = await screen.findByTestId('observation-notices', {}, OPTS)
    expect(within(notices).getByText('Low confidence')).toBeInTheDocument()
    expect(within(notices).getByText(/dashed, lighter regions/)).toBeInTheDocument()
  })

  it('applies the average-confidence rule, not only the flag', async () => {
    const hero = sample(ennore)
    const doubtful: Observation = { ...hero, averageConfidence: 0.42, warnings: [] }
    renderAt(`/observations/${ennore}`, apiWith(doubtful))
    const notices = await screen.findByTestId('observation-notices', {}, OPTS)
    expect(
      within(notices).getByText(/Average confidence is 42%, below the 60% threshold/),
    ).toBeInTheDocument()
  })

  it.each([
    ['Map', `/map/${ennore}`],
    ['Observation detail', `/observations/${ennore}`],
  ])('%s shows no caveats for a confident result', async (_surface, path) => {
    renderAt(path, mock())
    await screen.findAllByText(/Ennore coast/, {}, OPTS)
    expect(screen.queryByText('Low confidence')).not.toBeInTheDocument()
  })
})

describe('partial success, no debris and failed results', { timeout: 20_000 }, () => {
  const sundarbans = SAMPLE_IDS.sundarbans
  it.each([
    ['Map', `/map/${sundarbans}`],
    ['Observation detail', `/observations/${sundarbans}`],
    ['Report', `/observations/${sundarbans}/report`],
  ])('%s says positions are approximate', async (_surface, path) => {
    renderAt(path, mock())
    const notices = await screen.findByTestId('observation-notices', {}, OPTS)
    expect(within(notices).getByText('Approximate positions')).toBeInTheDocument()
  })

  it('Report states a no-debris result plainly', async () => {
    renderAt(`/observations/${SAMPLE_IDS.mannar}/report`, mock())
    expect(await screen.findByText('No debris detected.', {}, OPTS)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN/)
  })

  it('Map shows the no-debris card over the map', async () => {
    renderAt(`/map/${SAMPLE_IDS.mannar}`, mock())
    expect(
      await screen.findByRole('heading', { name: 'No debris detected' }, OPTS),
    ).toBeInTheDocument()
  })

  it.each([
    ['Map', `/map/${ennore}`],
    ['Report', `/observations/${ennore}/report`],
    ['Observation detail', `/observations/${ennore}`],
  ])('%s explains a failed observation', async (_surface, path) => {
    const failed: Observation = { ...sample(ennore), status: 'failed', detections: [] }
    renderAt(path, apiWith(failed))
    expect(
      await screen.findByRole('heading', { name: 'Processing failed' }, OPTS),
    ).toBeInTheDocument()
  })

  it('Observations list marks caveats on each row', async () => {
    renderAt('/observations', mock())
    expect((await screen.findAllByText('Low confidence', {}, OPTS)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Approximate positions').length).toBeGreaterThan(0)
    expect(screen.getAllByText('No debris').length).toBeGreaterThan(0)
  })
})
