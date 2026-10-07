import { ApiError } from './errors'
import type { ObservationsApi } from './types'

function notImplemented(method: keyof ObservationsApi): Promise<never> {
  return Promise.reject(
    new ApiError(
      `The live API client does not support ${method} yet. Set VITE_USE_MOCK=true to use sample data.`,
      { status: 501, code: 'NOT_IMPLEMENTED' },
    ),
  )
}

/**
 * HTTP implementation of ObservationsApi. Stub for now: every call rejects with NOT_IMPLEMENTED.
 * A later task fills this in against `baseUrl`, validating responses with the zod schemas.
 */
export function createHttpApi(baseUrl: string): ObservationsApi & { baseUrl: string } {
  return {
    baseUrl,
    listObservations: () => notImplemented('listObservations'),
    getObservation: () => notImplemented('getObservation'),
    createObservation: () => notImplemented('createObservation'),
    getJob: () => notImplemented('getJob'),
    health: () => notImplemented('health'),
  }
}
