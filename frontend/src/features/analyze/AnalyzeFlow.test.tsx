import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from '@/features/observations/api/mockApi'
import type { MockScenario } from '@/features/observations/mock/scenario'
import { AnalyzePage } from '@/pages/AnalyzePage'

function MapStub() {
  const { id } = useParams()
  const location = useLocation()
  return (
    <p>
      Map page {id} {location.search}
    </p>
  )
}

function setup(initial: MockScenario = 'success') {
  const scenario = { current: initial }
  const api = createMockApi({
    latencyMs: [0, 0],
    pollLatencyMs: [0, 0],
    pipelineDurationMs: 2000,
    scenario: () => scenario.current,
  })
  const router = createMemoryRouter(
    [
      { path: '/analyze', element: <AnalyzePage /> },
      { path: '/map/:id', element: <MapStub /> },
      { path: '/settings', element: <p>Settings page</p> },
    ],
    { initialEntries: ['/analyze'] },
  )
  render(
    <AppProviders api={api}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
  return { scenario, router, user }
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

async function pickHeroAndRun(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Ennore coast/ }))
  expect(screen.getByLabelText('Region name')).toHaveValue('Ennore coast, Bay of Bengal')
  await user.click(screen.getByRole('button', { name: 'Run detection' }))
}

beforeEach(() => {
  // Fake timers drive the pipeline; letting them also advance in real time keeps
  // user-event and Testing Library waits from stalling.
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Analyze flow', () => {
  it('keeps Run detection disabled with a reason until the form is complete', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Run detection' })).toBeDisabled()
    expect(screen.getByText('Choose an image or a sample scene to start.')).toBeInTheDocument()
    expect(screen.getByText(/GeoTIFF with embedded georeferencing is best/)).toBeInTheDocument()
  })

  it('runs a sample scene to success and opens the map on its own', async () => {
    const { router, user } = setup()
    await pickHeroAndRun(user)
    expect(screen.getByRole('heading', { name: 'Running detection' })).toBeInTheDocument()
    expect(screen.getByText(/Running UNet\+\+ marine debris segmentation/)).toBeInTheDocument()

    await advance(3000)
    expect(await screen.findByText('61 regions detected, 3 hotspots')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detection complete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /View results/ })).toBeInTheDocument()

    await advance(1100)
    expect(router.state.location.pathname).toBe('/map/obs-upload-0001')
    expect(router.state.location.search).toBe('?fresh=1')
  })

  it('stays on the summary when the user interacts before the map opens', async () => {
    const { router, user } = setup()
    await pickHeroAndRun(user)
    await advance(3000)
    await screen.findByText('61 regions detected, 3 hotspots')
    await user.keyboard('{Shift}')
    await advance(2000)
    expect(router.state.location.pathname).toBe('/analyze')
    expect(screen.getByText('The results are ready on the map.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /View results/ }))
    expect(router.state.location.pathname).toBe('/map/obs-upload-0001')
  })

  it('reports a model failure and retries with the same file and details', async () => {
    const { scenario, router, user } = setup('modelfail')
    await pickHeroAndRun(user)
    await advance(3000)
    expect(await screen.findByText('The detection step failed')).toBeInTheDocument()

    scenario.current = 'success'
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await advance(3000)
    expect(await screen.findByText('61 regions detected, 3 hotspots')).toBeInTheDocument()
    await advance(1100)
    expect(router.state.location.pathname).toMatch(/^\/map\/obs-upload-/)
  })

  it('reports a network failure, and Edit details returns to the filled form', async () => {
    const { user } = setup('network')
    await pickHeroAndRun(user)
    await advance(500)
    expect(await screen.findByText("Can't reach the processing service")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.getByLabelText('Region name')).toHaveValue('Ennore coast, Bay of Bengal')
    expect(screen.getByText('ennore-coast-sample.tif')).toBeInTheDocument()
  })

  it('reports an invalid image with the reason and lets the user choose another file', async () => {
    const { user } = setup('invalid')
    await pickHeroAndRun(user)
    await advance(3000)
    expect(await screen.findByText("This image can't be analysed")).toBeInTheDocument()
    expect(screen.getByText(/could not be read as an image with location data/)).toBeInTheDocument()
    const banner = screen.getByRole('alert')
    await user.click(within(banner).getByRole('button', { name: 'Choose another file' }))
    expect(screen.getByText(/Drop an image here, or browse/)).toBeInTheDocument()
    expect(screen.getByLabelText('Region name')).toHaveValue('Ennore coast, Bay of Bengal')
  })

  it('cancels back to the filled form', async () => {
    const { user } = setup()
    await pickHeroAndRun(user)
    await advance(100)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Run detection' })).toBeEnabled()
    expect(screen.getByLabelText('Region name')).toHaveValue('Ennore coast, Bay of Bengal')
    expect(screen.getByText('Analysis cancelled')).toBeInTheDocument()
  })

  it('keeps the draft when navigating away and back', async () => {
    const { router, user } = setup()
    await user.type(screen.getByLabelText('Region name'), 'Chennai harbour')
    await act(() => router.navigate('/settings'))
    expect(screen.getByText('Settings page')).toBeInTheDocument()
    await act(() => router.navigate('/analyze'))
    expect(screen.getByLabelText('Region name')).toHaveValue('Chennai harbour')
  })
})
