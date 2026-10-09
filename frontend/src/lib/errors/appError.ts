/**
 * One error shape for the whole UI. Whatever failed (a zod parse, an HTTP status, an aborted or
 * timed-out request, a dropped connection, a thrown exception) becomes an AppError with plain
 * copy from errorCopy.ts. Raw messages and stack traces never reach the screen.
 */
import { APP_ERROR_CODES, ERROR_COPY, type AppErrorCode } from './errorCopy'

export interface AppError {
  code: AppErrorCode
  title: string
  message: string
  /** True when trying again can work; false when the user has to change something first. */
  recoverable: boolean
  /** Present only for recoverable errors whose caller can repeat the action. */
  retry?: () => void
  /** Short technical reference for support, for example "HTTP 503" or "detections.3.confidence". */
  reference?: string
}

export interface ToAppErrorOptions {
  /** Repeats the failed action. Attached only when the error is recoverable. */
  retry?: () => void
  /** Connection state; defaults to navigator.onLine. A network failure while offline is OFFLINE. */
  online?: boolean
}

/** Error codes the API layer and job errors use, mapped to app codes. */
const SOURCE_CODES: Readonly<Record<string, AppErrorCode>> = {
  OFFLINE: 'OFFLINE',
  NETWORK_ERROR: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  INVALID_IMAGE: 'INVALID_IMAGE',
  MODEL_ERROR: 'MODEL_FAILED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  // The processing service (docs/BACKEND_CONTRACT.md).
  INVALID_BANDS: 'INVALID_IMAGE',
  NO_GEOREF: 'INVALID_IMAGE',
  UNREADABLE: 'INVALID_IMAGE',
  TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_SOURCE: 'UNSUPPORTED_FILE',
  INVALID_REQUEST: 'BAD_REQUEST',
  QUEUE_FULL: 'SERVICE_UNAVAILABLE',
  MODEL_FAILURE: 'MODEL_FAILED',
}

/** Service codes more specific than the app code they map to: kept as the reference. */
const SPECIFIC_SOURCE_CODES: ReadonlySet<string> = new Set([
  'INVALID_BANDS',
  'NO_GEOREF',
  'UNREADABLE',
  'TOO_LARGE',
  'UNSUPPORTED_SOURCE',
  'INVALID_REQUEST',
  'QUEUE_FULL',
  'MODEL_FAILURE',
])

/** HTTP status to app code. Anything else in 4xx is BAD_REQUEST and in 5xx is SERVER. */
export function codeForStatus(status: number): AppErrorCode {
  switch (status) {
    case 401:
    case 403:
      return 'ACCESS_DENIED'
    case 404:
    case 410:
      return 'NOT_FOUND'
    case 408:
    case 504:
      return 'TIMEOUT'
    case 413:
      return 'FILE_TOO_LARGE'
    case 415:
      return 'UNSUPPORTED_FILE'
    case 422:
      return 'INVALID_IMAGE'
    case 429:
      return 'RATE_LIMITED'
    case 501:
      return 'NOT_IMPLEMENTED'
    case 502:
    case 503:
      return 'SERVICE_UNAVAILABLE'
  }
  if (status >= 400 && status < 500) return 'BAD_REQUEST'
  if (status >= 500) return 'SERVER'
  return 'UNEXPECTED'
}

export function createAppError(
  code: AppErrorCode,
  options: { retry?: () => void; reference?: string } = {},
): AppError {
  const copy = ERROR_COPY[code]
  return {
    code,
    title: copy.title,
    message: copy.message,
    recoverable: copy.recoverable,
    ...(copy.recoverable && options.retry ? { retry: options.retry } : {}),
    ...(options.reference ? { reference: options.reference } : {}),
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function isAppError(value: unknown): value is AppError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    (APP_ERROR_CODES as readonly string[]).includes(value.code) &&
    typeof value.title === 'string' &&
    typeof value.message === 'string' &&
    typeof value.recoverable === 'boolean'
  )
}

interface IssueLike {
  path: string
  message: string
}

/** zod's ZodError, by shape, so this module does not depend on zod. */
function zodIssues(value: unknown): IssueLike[] | null {
  if (!isRecord(value) || value.name !== 'ZodError' || !Array.isArray(value.issues)) return null
  return value.issues.filter(isRecord).map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.map(String).join('.') : '',
    message: typeof issue.message === 'string' ? issue.message : '',
  }))
}

/** The app's own ParseIssue[] from schemas.ts. */
function parseIssues(value: unknown): IssueLike[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  return value.every((item) => isRecord(item) && typeof item.path === 'string')
    ? (value as IssueLike[])
    : null
}

const issueReference = (issues: IssueLike[]) => {
  const first = issues[0]
  if (!first) return undefined
  return first.path ? `Invalid field: ${first.path}` : 'Invalid response'
}

/** Messages browsers use for a fetch that never reached the server. */
const FETCH_FAILURE = /failed to fetch|networkerror|load failed|network request failed/i

function defaultOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/**
 * Turns anything that was thrown or returned as a failure into an AppError:
 * AppErrors, ApiErrors (by code and status), job errors ({ code, message }), HTTP statuses
 * (a number or anything with a numeric `status`), zod errors, the app's parse issues,
 * AbortError and TimeoutError DOMExceptions, failed fetches, other Errors and plain values.
 */
export function toAppError(input: unknown, options: ToAppErrorOptions = {}): AppError {
  const online = options.online ?? defaultOnline()
  const make = (code: AppErrorCode, reference?: string) => {
    // A connection failure while the device is offline is reported as being offline.
    const resolved = code === 'NETWORK' && !online ? 'OFFLINE' : code
    return createAppError(resolved, { retry: options.retry, reference })
  }

  if (isAppError(input)) {
    return {
      ...input,
      ...(input.recoverable && options.retry ? { retry: options.retry } : {}),
    }
  }

  const fromZod = zodIssues(input)
  if (fromZod) return make('INVALID_RESPONSE', issueReference(fromZod))
  const fromParse = parseIssues(input)
  if (fromParse) return make('INVALID_RESPONSE', issueReference(fromParse))

  if (typeof input === 'number') return make(codeForStatus(input), `HTTP ${input}`)

  if (isRecord(input) && (input.name === 'AbortError' || input.name === 'TimeoutError')) {
    return make(input.name === 'TimeoutError' ? 'TIMEOUT' : 'ABORTED')
  }

  if (isRecord(input)) {
    const status = typeof input.status === 'number' ? input.status : null
    const sourceCode = typeof input.code === 'string' ? SOURCE_CODES[input.code] : undefined
    const httpReference = status !== null ? `HTTP ${status}` : undefined
    const reference =
      typeof input.code === 'string' && SPECIFIC_SOURCE_CODES.has(input.code)
        ? [input.code, httpReference].filter(Boolean).join(', ')
        : httpReference
    if (sourceCode) return make(sourceCode, reference)
    if (status !== null && status >= 400) return make(codeForStatus(status), reference)
    if ('status' in input && input.status === null && typeof input.code === 'string') {
      // An API error that never got a response.
      return make('NETWORK')
    }
    if (
      typeof input.code === 'string' &&
      typeof input.message === 'string' &&
      !(input instanceof Error)
    ) {
      // A job error with a code this app does not know: the service failed.
      return make('SERVER', input.code)
    }
  }

  if (input instanceof TypeError && FETCH_FAILURE.test(input.message)) return make('NETWORK')

  return make('UNEXPECTED')
}

const AUTO_RETRYABLE: ReadonlySet<AppErrorCode> = new Set([
  'NETWORK',
  'TIMEOUT',
  'SERVER',
  'SERVICE_UNAVAILABLE',
  'RATE_LIMITED',
  'UNEXPECTED',
])

/**
 * Whether a failed request is worth retrying automatically: transient service and network
 * problems only. Being offline fails fast so the screen never hangs; the user retries instead.
 */
export function isAutoRetryable(error: AppError): boolean {
  return AUTO_RETRYABLE.has(error.code)
}
