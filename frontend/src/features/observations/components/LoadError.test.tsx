import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsContext } from '@/features/settings/settingsContext'
import { createSettingsStore } from '@/features/settings/settingsStore'
import { ApiError, networkError } from '../api/errors'
import { LoadError } from './ObservationStates'

function renderWith(useMock: boolean, error: unknown, dataSource?: 'live') {
  const store = createSettingsStore({
    storage: null,
    env: { useMock, apiBaseUrl: 'http://localhost:8000' },
  })
  if (dataSource) store.update({ dataSource })
  render(
    <SettingsContext value={store}>
      <LoadError error={error} onRetry={vi.fn()} />
    </SettingsContext>,
  )
  return store
}

describe('LoadError', () => {
  it('offers sample data when the live service cannot be reached, where the mock is on', async () => {
    const store = renderWith(true, networkError(), 'live')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Switch to sample data' }))
    expect(store.get().dataSource).toBe('mock')
  })

  it('never offers it where the environment keeps the app on the live service', () => {
    const store = renderWith(false, networkError())
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch to sample data' })).toBeNull()
    expect(store.get().dataSource).toBe('live')
  })

  it('does not offer it for a request that is wrong, or in sample mode', () => {
    renderWith(false, new ApiError('Gone.', { status: 404, code: 'NOT_FOUND' }))
    expect(screen.queryByRole('button', { name: 'Switch to sample data' })).toBeNull()
  })

  it('does not offer it when already on sample data', () => {
    renderWith(true, networkError())
    expect(screen.queryByRole('button', { name: 'Switch to sample data' })).toBeNull()
  })
})
