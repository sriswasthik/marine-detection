export type ApiErrorCode =
  | 'NETWORK_ERROR'
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
 * TanStack Query retry rule. Never retries 4xx responses (the request itself is wrong),
 * cancelled requests, or endpoints that are not implemented. Retries network and 5xx errors
 * up to MAX_QUERY_RETRIES times.
 */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false
  if (isAbortError(error) || isClientError(error)) return false
  if (error instanceof ApiError && error.code === 'NOT_IMPLEMENTED') return false
  return true
}
