import { QueryClient } from '@tanstack/react-query'
import { shouldRetryRequest } from '@/features/observations/api/errors'

/**
 * Retry rules: transient network and service errors retry twice with backoff; 4xx, cancelled,
 * not-implemented and offline requests never retry. Mutations never retry. Window focus does not
 * refetch, so the screen stays still during a live demo.
 *
 * networkMode 'always': requests run even when the browser reports offline, so the API layer
 * fails them at once with a recoverable OFFLINE error instead of TanStack Query pausing them
 * (which would leave a spinner up indefinitely).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryRequest,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        networkMode: 'always',
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  })
}
