import { isAutoRetryable, toAppError } from '@/lib/errors/appError'

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'INVALID_RESPONSE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE'
  | 'NOT_IMPLEMENTED'
  | 'SERVER_ERROR'

export class ApiError extends Error {
  /** HTTP status, or null when the request never got a response. */
  readonly status: number | null
  readonly code: ApiErrorCode

  constructor(
    message: string,
    options: { status: number | null; code: ApiErrorCode; cause?: unknown },
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
  }
}

export function networkError(cause?: unknown): ApiError {
  return new ApiError(
    'Could not reach the analysis service. Check your connection and try again.',
    { status: null, code: 'NETWORK_ERROR', cause },
  )
}

/** The device is offline, so the request was not sent. Fails at once instead of hanging. */
export function offlineError(): ApiError {
  return new ApiError('The device is offline.', { status: null, code: 'OFFLINE' })
}

/** The service did not answer within the time limit. */
export function timeoutError(timeoutMs: number): ApiError {
  return new ApiError(`No response within ${Math.round(timeoutMs / 1000)} s.`, {
    status: null,
    code: 'TIMEOUT',
  })
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function isClientError(error: unknown): boolean {
  return (
    error instanceof ApiError && error.status !== null && error.status >= 400 && error.status < 500
  )
}

/** Retries after the first failure. */
export const MAX_QUERY_RETRIES = 2

/**
 * TanStack Query retry rule: transient network and service failures retry up to
 * MAX_QUERY_RETRIES times (see isAutoRetryable). Requests that are wrong (4xx), cancelled,
 * not implemented or made while offline never retry, so the screen shows the error at once.
 */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false
  return isAutoRetryable(toAppError(error))
}
