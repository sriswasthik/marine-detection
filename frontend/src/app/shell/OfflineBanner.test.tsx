import { QueryClient, useQuery } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from '@/features/observations/api/mockApi'
import { OfflineBanner } from './OfflineBanner'

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

/** A query that fails until it is refetched, to check reconnection reloads it. */
function FailingQuery({ fetcher }: { fetcher: () => Promise<string> }) {
  const query = useQuery({ queryKey: ['probe'], queryFn: fetcher, retry: false })
  return <p>{query.isError ? 'query failed' : (query.data ?? 'loading')}</p>
}

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.style.removeProperty('--offline-bar-height')
})

describe('OfflineBanner', () => {
  it('appears when the connection drops and leaves when it returns', async () => {
    const api = createMockApi({ latencyMs: [0, 0], scenario: () => 'success' })
    render(
      <AppProviders api={api}>
        <OfflineBanner />
      </AppProviders>,
    )
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument()

    setOnline(false)
    expect(screen.getByRole('status')).toHaveTextContent(/You're offline/)
    expect(screen.getByText(/New requests will fail until you reconnect/)).toBeInTheDocument()

    setOnline(true)
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument()
    expect(await screen.findByText('Back online')).toBeInTheDocument()
  })

  it('reloads failed queries when the connection returns', async () => {
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('loaded again')
    const queryClient = new QueryClient()
    render(
      <AppProviders api={createMockApi()} queryClient={queryClient}>
        <OfflineBanner />
        <FailingQuery fetcher={fetcher} />
      </AppProviders>,
    )
    expect(await screen.findByText('query failed')).toBeInTheDocument()
    setOnline(false)
    setOnline(true)
    expect(await screen.findByText('loaded again')).toBeInTheDocument()
  })
})
