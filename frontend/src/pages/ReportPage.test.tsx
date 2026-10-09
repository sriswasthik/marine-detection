import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { routes } from '@/test/routes'
import { createMockApi } from '@/features/observations/api/mockApi'
import { SAMPLE_IDS } from '@/features/observations/mock/samples'

function renderReport(id: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/observations/${id}/report`] })
  render(
    <AppProviders api={createMockApi({ latencyMs: [0, 0], scenario: () => 'success' })}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

afterEach(() => vi.useRealTimers())

describe('Report page', { timeout: 15_000 }, () => {
  it('lays out the one-page report for the hero scene', async () => {
    renderReport(SAMPLE_IDS.ennore)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ennore coast, Bay of Bengal' }),
    ).toBeInTheDocument()
    for (const label of [
      'Detected area',
      'Water area',
      'Coverage',
      'Average confidence',
      'Detected regions',
      'Hotspots',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    for (const heading of [
      'Measurements',
      'Density classification',
      'Top 5 hotspots',
      'Method and caveats',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(/U-Net marine debris segmentation 0\.1\.0/)).toBeInTheDocument()
    expect(screen.getByText(/synthetic sample data/)).toBeInTheDocument()
    expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument()
    expect(screen.getByText(/^Generated/)).toBeInTheDocument()
    expect(screen.getAllByText(/° N, /).length).toBeGreaterThan(0)
  })

  it('keeps printing disabled until the map tiles have loaded, with a time limit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderReport(SAMPLE_IDS.ennore)
    const button = await screen.findByRole('button', { name: 'Print or save as PDF' })
    // jsdom never loads tiles, so the page waits.
    expect(button).toBeDisabled()
    expect(screen.getByText('Waiting for the map tiles to finish loading.')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(button).toBeEnabled()
    expect(screen.getByText(/Some map tiles did not load/)).toBeInTheDocument()
  })

  it('states a no-debris result and shows real zeros', async () => {
    renderReport(SAMPLE_IDS.mannar)
    expect(await screen.findByText('No debris detected.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN/)
    expect(screen.getByText(/No hotspots:/)).toBeInTheDocument()
  })
})
