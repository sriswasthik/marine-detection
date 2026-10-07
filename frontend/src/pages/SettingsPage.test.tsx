import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/router'
import { createMockApi } from '@/features/observations/api/mockApi'
import { SAMPLE_IDS } from '@/features/observations/mock/samples'
import { createSettingsStore, type SettingsStore } from '@/features/settings/settingsStore'
import { DEFAULT_DISPLAY_PREFERENCES, setDisplayPreferences } from '@/lib/format'
import { SETTINGS_STORAGE_KEY } from '@/lib/settings'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

function renderAt(path: string, store: SettingsStore) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders
      api={createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0], scenario: () => 'success' })}
      settingsStore={store}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return userEvent.setup()
}

const env = { useMock: true, apiBaseUrl: 'http://localhost:8000' }
const freshStore = (initial?: Record<string, string>) =>
  createSettingsStore({ storage: memoryStorage(initial), env })

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  setDisplayPreferences(DEFAULT_DISPLAY_PREFERENCES)
})

describe('Settings page', { timeout: 15_000 }, () => {
  it('saves a unit at once and says so', async () => {
    const store = freshStore()
    const user = renderAt('/settings', store)
    const units = await screen.findByRole('radiogroup', { name: 'Area unit' })
    await user.click(within(units).getByRole('radio', { name: 'ha' }))
    expect(store.get().areaUnit).toBe('ha')
    expect(screen.getByText('Saved')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Degrees, minutes, seconds' }))
    expect(store.get().coordinateFormat).toBe('dms')
    expect(screen.getByText('13°13′17.4″ N, 80°21′43.6″ E')).toBeInTheDocument()
  })

  it('saves map defaults', async () => {
    const store = freshStore()
    const user = renderAt('/settings', store)
    await user.click(await screen.findByRole('radio', { name: 'Satellite' }))
    await user.click(screen.getByRole('checkbox', { name: 'Density' }))
    expect(store.get()).toMatchObject({
      defaultBasemap: 'satellite',
      defaultLayers: { density: true },
    })
    expect(screen.getByText('Placeholder values')).toBeInTheDocument()
  })

  it('tests the live service and switches only after it answers', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(json({ ok: true, modelName: 'Debris UNet++', modelVersion: '1.2.0' })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const store = freshStore()
    const user = renderAt('/settings', store)
    await user.click(await screen.findByRole('radio', { name: 'Live API' }))
    const use = screen.getByRole('button', { name: 'Use this service' })
    expect(use).toBeDisabled()
    expect(store.get().dataSource).toBe('mock')

    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(
      await screen.findByText(/Connected. The service runs Debris UNet\+\+ 1\.2\.0/),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/health', expect.anything())

    await user.click(screen.getByRole('button', { name: 'Use this service' }))
    expect(store.get()).toMatchObject({ dataSource: 'live', apiBaseUrl: 'http://localhost:8000' })
    expect(await screen.findByText('Using the live service')).toBeInTheDocument()
  })

  it.each([
    [
      'an unreachable service',
      () => Promise.reject(new TypeError('Failed to fetch')),
      "Can't reach the processing service",
    ],
    ['a missing health endpoint', () => Promise.resolve(json({}, 404)), 'Not found'],
    [
      'an unexpected answer',
      () => Promise.resolve(json({ status: 'up' })),
      'The service sent data this app cannot read',
    ],
    [
      'a server error',
      () => Promise.resolve(json({}, 503)),
      'The processing service is unavailable',
    ],
  ])('explains %s', async (_case, respond, title) => {
    vi.stubGlobal('fetch', vi.fn(respond))
    const store = freshStore()
    const user = renderAt('/settings', store)
    await user.click(await screen.findByRole('radio', { name: 'Live API' }))
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use this service' })).toBeDisabled()
    expect(store.get().dataSource).toBe('mock')
  })

  it('checks the address before testing it', async () => {
    const user = renderAt('/settings', freshStore())
    await user.click(await screen.findByRole('radio', { name: 'Live API' }))
    const input = screen.getByRole('textbox', { name: 'API base URL' })
    await user.clear(input)
    await user.type(input, 'api.example.org')
    expect(screen.getByText(/http:\/\//)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled()
  })

  it('says so when saved settings could not be read', async () => {
    renderAt('/settings', freshStore({ [SETTINGS_STORAGE_KEY]: '{broken' }))
    expect(await screen.findByText('Settings were reset')).toBeInTheDocument()
  })

  it('shows the model card with sample values and limitations', async () => {
    renderAt('/settings', freshStore())
    const card = (await screen.findByRole('heading', { name: 'Model card' })).closest('section')
    if (!card) throw new Error('no model card')
    expect(within(card).getByText('Sample values')).toBeInTheDocument()
    expect(within(card).getByText(/Sun-glint/)).toBeInTheDocument()
    expect(screen.getByText('Copernicus Sentinel-2')).toBeInTheDocument()
  })
})

describe('units apply everywhere at once', { timeout: 15_000 }, () => {
  it('updates every area on the detail page when the unit changes', async () => {
    const store = freshStore()
    renderAt(`/observations/${SAMPLE_IDS.mannar}`, store)
    await screen.findByRole('heading', { level: 1, name: 'Gulf of Mannar' })
    const waterArea = () =>
      screen.getByText('Water area').closest('div.rounded-card')?.textContent ?? ''
    expect(waterArea()).toContain('20.0 km²')

    act(() => {
      store.update({ areaUnit: 'ha' })
    })
    expect(waterArea()).toContain('2,000 ha')
    // The no-debris card, a different component, follows too.
    const noDebris = screen.getByRole('heading', { name: 'No debris detected' }).closest('section')
    expect(noDebris).toHaveTextContent('2,000 ha')
  })
})
