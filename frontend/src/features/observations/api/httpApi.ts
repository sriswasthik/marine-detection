import { z } from 'zod'
import { ApiError, networkError } from './errors'
import type { HealthStatus, ObservationsApi, RequestOptions } from './types'

function notImplemented(method: keyof ObservationsApi): Promise<never> {
  return Promise.reject(
    new ApiError(
      `The live API client does not support ${method} yet. Set VITE_USE_MOCK=true to use sample data.`,
      { status: 501, code: 'NOT_IMPLEMENTED' },
    ),
  )
}

const HealthSchema = z.object({
  ok: z.boolean(),
  modelName: z.string().min(1),
  modelVersion: z.string().min(1),
})

/** HTTP status to the transport error code; the UI's wording comes from toAppError. */
function statusError(status: number): ApiError {
  const code = status === 404 ? 'NOT_FOUND' : status === 501 ? 'NOT_IMPLEMENTED' : 'SERVER_ERROR'
  return new ApiError(`The service answered HTTP ${status}.`, { status, code })
}

async function getJson(
  url: string,
  options: RequestOptions,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      signal: options.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw networkError(error)
  }
  if (!response.ok) throw statusError(response.status)
  try {
    return (await response.json()) as unknown
  } catch (error) {
    throw new ApiError('The service did not answer with JSON.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
      cause: error,
    })
  }
}

/**
 * HTTP implementation of ObservationsApi. `health` is live (GET {baseUrl}/health); the other calls
 * reject with NOT_IMPLEMENTED until the service contract is wired up.
 */
export function createHttpApi(
  baseUrl: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ObservationsApi & { baseUrl: string } {
  return {
    baseUrl,
    listObservations: () => notImplemented('listObservations'),
    getObservation: () => notImplemented('getObservation'),
    createObservation: () => notImplemented('createObservation'),
    getJob: () => notImplemented('getJob'),
    async health(options = {}): Promise<HealthStatus> {
      const body = await getJson(`${baseUrl}/health`, options, fetchImpl)
      const parsed = HealthSchema.safeParse(body)
      if (!parsed.success) {
        throw new ApiError('The health response did not match the expected shape.', {
          status: 200,
          code: 'INVALID_RESPONSE',
          cause: parsed.error,
        })
      }
      return { ...parsed.data, mode: 'http' }
    },
  }
}
