import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
  expect(screen.getByLabelText(/^Region name/)).toHaveValue('Ennore coast, Bay of Bengal')
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
    expect(
      screen.getByText(/PNG, JPEG and drone images cannot be analysed by this model/),
    ).toBeInTheDocument()
  })

  it('refuses a PNG up front, without asking for bounds', async () => {
    setup()
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input?.accept).toBe('image/tiff,.tif,.tiff')
    if (!input) throw new Error('file input missing')
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'flight-07.png', {
      type: 'image/png',
    })
    fireEvent.change(input, { target: { files: [png] } })
    expect(
      await screen.findByText(
        '.png images hold 3 colour bands. The model needs an 11-band Sentinel-2 GeoTIFF.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Bands')).not.toBeInTheDocument()
    expect(screen.getByText('No preview. This file cannot be analysed.')).toBeInTheDocument()
    expect(screen.queryByLabelText('North')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run detection' })).toBeDisabled()
  })

  it('starts one analysis when Run detection is clicked twice', async () => {
    const { router, user } = setup()
    await user.click(screen.getByRole('button', { name: /Ennore coast/ }))
    const run = screen.getByRole('button', { name: 'Run detection' })
    // Both clicks land before the button gives way to the stepper.
    run.click()
    run.click()
    await advance(3000)
    await screen.findByText('61 regions detected, 3 hotspots')
    await user.click(screen.getByRole('button', { name: /Open on the map/ }))
    expect(router.state.location.pathname).toBe('/map/obs-upload-0001')
  })

  it('runs a sample scene to success and shows the analysis report', async () => {
    const { router, user } = setup()
    await pickHeroAndRun(user)
    expect(screen.getByRole('heading', { name: 'Running detection' })).toBeInTheDocument()
    expect(screen.getByText(/Running U-Net marine debris segmentation/)).toBeInTheDocument()

    await advance(3000)
    expect(await screen.findByText('61 regions detected, 3 hotspots')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detection complete' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Analysis report' })).toBeInTheDocument()
    expect(screen.getByText('Model loaded successfully')).toBeInTheDocument()
    expect(screen.getByText('Prediction complete')).toBeInTheDocument()
    // Synthetic samples carry no raster facts or files; the report says so instead of inventing them.
    expect(screen.getByText(/this\s+result has none/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download QGIS style (.qml)' })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Download segmentation GeoTIFF' }),
    ).not.toBeInTheDocument()

    // The report stays until the user opens the map.
    await advance(2000)
    expect(router.state.location.pathname).toBe('/analyze')
    await user.click(screen.getByRole('button', { name: /Open on the map/ }))
    expect(router.state.location.pathname).toBe('/map/obs-upload-0001')
    expect(router.state.location.search).toBe('?fresh=1')
  })

  it('runs without a region name: the field is optional', async () => {
    const { router, user } = setup()
    await user.click(screen.getByRole('button', { name: /Ennore coast/ }))
    await user.clear(screen.getByLabelText(/^Region name/))
    expect(
      screen.getByText(/Left empty, the result is named after its location/),
    ).toBeInTheDocument()
    const run = screen.getByRole('button', { name: 'Run detection' })
    expect(run).toBeEnabled()
    await user.click(run)
    await advance(3000)
    expect(await screen.findByText('61 regions detected, 3 hotspots')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Open on the map/ }))
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
    await user.click(screen.getByRole('button', { name: /Open on the map/ }))
    expect(router.state.location.pathname).toMatch(/^\/map\/obs-upload-/)
  })

  it('reports a network failure, and Edit details returns to the filled form', async () => {
    const { user } = setup('network')
    await pickHeroAndRun(user)
    await advance(500)
    expect(await screen.findByText("Can't reach the processing service")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.getByLabelText(/^Region name/)).toHaveValue('Ennore coast, Bay of Bengal')
    expect(screen.getByText('ennore-coast-sample.tif')).toBeInTheDocument()
  })

  it('reports an invalid image with the reason and lets the user choose another file', async () => {
    const { user } = setup('invalid')
    await pickHeroAndRun(user)
    await advance(3000)
    expect(await screen.findByText("This image can't be analysed")).toBeInTheDocument()
    expect(
      screen.getByText(/could not be read as an 11-band Sentinel-2 GeoTIFF with location data/),
    ).toBeInTheDocument()
    const banner = screen.getByRole('alert')
    await user.click(within(banner).getByRole('button', { name: 'Choose another file' }))
    expect(screen.getByText(/Drop an image here, or browse/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Region name/)).toHaveValue('Ennore coast, Bay of Bengal')
  })

  it('cancels back to the filled form', async () => {
    const { user } = setup()
    await pickHeroAndRun(user)
    await advance(100)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Run detection' })).toBeEnabled()
    expect(screen.getByLabelText(/^Region name/)).toHaveValue('Ennore coast, Bay of Bengal')
    expect(screen.getByText('Analysis cancelled')).toBeInTheDocument()
  })

  it('keeps the draft when navigating away and back', async () => {
    const { router, user } = setup()
    await user.type(screen.getByLabelText(/^Region name/), 'Chennai harbour')
    await act(() => router.navigate('/settings'))
    expect(screen.getByText('Settings page')).toBeInTheDocument()
    await act(() => router.navigate('/analyze'))
    expect(screen.getByLabelText(/^Region name/)).toHaveValue('Chennai harbour')
  })
})
