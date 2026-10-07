import { REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from '@/lib/config'
import { offlineError, timeoutError } from './errors'
import type { ObservationsApi, RequestOptions } from './types'

export interface ResilienceOptions {
  /** Current connection state. Defaults to navigator.onLine. */
  isOnline?: () => boolean
  /** Time limit for reads and job polling, ms. */
  timeoutMs?: number
  /** Time limit for an upload, ms. Uploads of large images take longer. */
  uploadTimeoutMs?: number
}

const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

/**
 * Runs one call with a time limit and a connection guard. Rejects at once when offline, when the
 * connection drops mid-request, or when the time limit passes, and aborts the underlying request
 * in each case. A cancellation by the caller passes through unchanged.
 */
function guarded<T>(
  run: (signal: AbortSignal) => Promise<T>,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
  isOnline: () => boolean,
): Promise<T> {
  if (!isOnline()) return Promise.reject(offlineError())
  const controller = new AbortController()
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.removeEventListener('offline', onOffline)
      callerSignal?.removeEventListener('abort', onCallerAbort)
      settle()
    }
    const fail = (error: unknown) => {
      controller.abort()
      finish(() => reject(error))
    }
    const onOffline = () => fail(offlineError())
    const onCallerAbort = () => controller.abort(callerSignal?.reason)
    const timer = window.setTimeout(() => fail(timeoutError(timeoutMs)), timeoutMs)

    window.addEventListener('offline', onOffline)
    if (callerSignal?.aborted) controller.abort(callerSignal.reason)
    else callerSignal?.addEventListener('abort', onCallerAbort, { once: true })

    run(controller.signal).then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    )
  })
}

/**
 * Wraps any ObservationsApi so no call can hang: offline requests fail immediately with a
 * recoverable OFFLINE error, and slow ones fail with TIMEOUT.
 */
export function withResilience(
  api: ObservationsApi,
  options: ResilienceOptions = {},
): ObservationsApi {
  const isOnline = options.isOnline ?? browserOnline
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  const uploadTimeoutMs = options.uploadTimeoutMs ?? UPLOAD_TIMEOUT_MS
  const call = <T>(
    fn: (options: RequestOptions) => Promise<T>,
    options: RequestOptions = {},
    limit = timeoutMs,
  ) => guarded((signal) => fn({ ...options, signal }), options.signal, limit, isOnline)

  return {
    listObservations: (options) => call((o) => api.listObservations(o), options),
    getObservation: (id, options) => call((o) => api.getObservation(id, o), options),
    createObservation: (input, options = {}) =>
      call((o) => api.createObservation(input, { ...options, ...o }), options, uploadTimeoutMs),
    getJob: (jobId, options) => call((o) => api.getJob(jobId, o), options),
    health: (options) => call((o) => api.health(o), options),
  }
}
