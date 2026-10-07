import { QueryClient } from '@tanstack/react-query'
import { shouldRetryRequest } from '@/features/observations/api/errors'

/**
 * Retry rules: never retry 4xx, cancelled or not-implemented requests; retry network and 5xx
 * errors twice with backoff. Mutations never retry. Window focus does not refetch, so the
 * screen stays still during a live demo.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryRequest,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
