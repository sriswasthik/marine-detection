/**
 * HTTP implementation of ObservationsApi, against the FastAPI service in backend/app.
 * The contract is docs/BACKEND_CONTRACT.md. Every response goes through the same zod validation
 * as the mock, so the screens cannot tell the two apart.
 */
import { z } from 'zod'
import { parseObservation, parseObservationList, type ParseIssue } from '../schemas'
import type { Observation, ObservationSummary } from '../types'
import { ApiError, networkError, type ApiErrorCode } from './errors'
import {
  JOB_STATUSES,
  JOB_STEPS,
  type CreateObservationInput,
  type HealthStatus,
  type Job,
  type ObservationsApi,
  type RequestOptions,
  type Validated,
} from './types'

const HealthSchema = z.object({
  ok: z.boolean(),
  modelName: z.string().min(1),
  modelVersion: z.string().min(1),
})

const JobSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(JOB_STATUSES),
  step: z.enum(JOB_STEPS),
  progress: z.number().min(0).max(100),
  observationId: z.string().min(1).optional(),
  error: z.object({ code: z.string(), message: z.string(), recoverable: z.boolean() }).optional(),
}) satisfies z.ZodType<Job>

const CreatedSchema = z.object({ jobId: z.string().min(1) })

/** The service's error body: { error: { code, message, recoverable } }. */
const ErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

/** Service error codes this app knows; anything else falls back to the HTTP status. */
const SERVICE_CODES: ReadonlySet<string> = new Set<ApiErrorCode>([
  'NOT_FOUND',
  'UNSUPPORTED_FILE',
  'INVALID_BANDS',
  'NO_GEOREF',
  'UNREADABLE',
  'TOO_LARGE',
  'UNSUPPORTED_SOURCE',
  'INVALID_REQUEST',
  'QUEUE_FULL',
  'SERVER_ERROR',
])

/** HTTP status to the transport error code; the UI's wording comes from toAppError. */
function statusError(status: number): ApiError {
  const code = status === 404 ? 'NOT_FOUND' : status === 501 ? 'NOT_IMPLEMENTED' : 'SERVER_ERROR'
  return new ApiError(`The service answered HTTP ${status}.`, { status, code })
}

/** An error response as an ApiError, keeping the service's code when this app knows it. */
export function errorFromResponse(status: number, body: unknown): ApiError {
  const parsed = ErrorBodySchema.safeParse(body)
  if (parsed.success && SERVICE_CODES.has(parsed.data.error.code)) {
    return new ApiError(parsed.data.error.message, {
      status,
      code: parsed.data.error.code as ApiErrorCode,
    })
  }
  return statusError(status)
}

function invalidResponse(issues: readonly ParseIssue[], status = 200): ApiError {
  const first = issues[0]
  return new ApiError(
    `The service returned data this app cannot read${first ? ` (${first.path || 'response'}: ${first.message})` : ''}.`,
    { status, code: 'INVALID_RESPONSE' },
  )
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

async function requestJson(
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
  const text = await response.text().catch(() => '')
  const body = parseJson(text)
  if (!response.ok) throw errorFromResponse(response.status, body)
  if (body === undefined) {
    throw new ApiError('The service did not answer with JSON.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    })
  }
  return body
}

export interface UploadRequest {
  url: string
  form: FormData
  signal?: AbortSignal
  onProgress?: (percent: number) => void
}

export type UploadTransport = (request: UploadRequest) => Promise<{ status: number; body: unknown }>

/** Upload with progress events, which fetch does not offer: XMLHttpRequest. */
export const xhrUpload: UploadTransport = ({ url, form, signal, onProgress }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const onAbort = () => xhr.abort()
    xhr.open('POST', url)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort)
      resolve({ status: xhr.status, body: parseJson(xhr.responseText) })
    }
    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(networkError())
    }
    xhr.onabort = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new DOMException('The upload was cancelled.', 'AbortError'))
    }
    if (signal?.aborted) {
      reject(new DOMException('The upload was cancelled.', 'AbortError'))
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    xhr.send(form)
  })

export interface HttpApiOptions {
  fetchImpl?: typeof fetch
  upload?: UploadTransport
}

/**
 * The service grades density, so summaries arrive with their level. One stored before it did has
 * densityLevel null: fill it from its observation (fetched once and cached, observations do not
 * change), so the list shows the same level as the detail page. A level that cannot be fetched is
 * reported as a partial-data issue rather than shown as "No debris".
 */
async function withDensity(
  summaries: ObservationSummary[],
  detail: (id: string) => Promise<Observation | null>,
): Promise<{ summaries: ObservationSummary[]; issues: ParseIssue[] }> {
  const issues: ParseIssue[] = []
  const filled = await Promise.all(
    summaries.map(async (summary, index) => {
      if (summary.densityLevel !== null || summary.detectionCount === 0) return summary
      const observation = await detail(summary.id)
      if (!observation) {
        issues.push({ path: `${index}.densityLevel`, message: 'Density level could not be loaded' })
        return summary
      }
      return { ...summary, densityLevel: observation.densityLevel }
    }),
  )
  return { summaries: filled, issues }
}

/** HTTP implementation of ObservationsApi (see docs/BACKEND_CONTRACT.md). */
export function createHttpApi(
  baseUrl: string,
  options: HttpApiOptions = {},
): ObservationsApi & { baseUrl: string } {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const upload = options.upload ?? xhrUpload
  const root = baseUrl.replace(/\/+$/, '')
  const url = (path: string) => `${root}${path}`
  /** Parsed observations by id. A finished observation never changes, so this never expires. */
  const cache = new Map<string, Observation>()

  async function getObservation(
    id: string,
    requestOptions: RequestOptions = {},
  ): Promise<Validated<Observation>> {
    const body = await requestJson(
      url(`/api/observations/${encodeURIComponent(id)}`),
      requestOptions,
      fetchImpl,
    )
    const result = parseObservation(body)
    if (result.status === 'invalid') throw invalidResponse(result.issues)
    if (result.status === 'valid') cache.set(id, result.data)
    return { data: result.data, issues: result.issues }
  }

  async function cachedDetail(id: string, signal?: AbortSignal): Promise<Observation | null> {
    const cached = cache.get(id)
    if (cached) return cached
    try {
      return (await getObservation(id, { signal })).data
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return null
    }
  }

  return {
    baseUrl: root,

    async listObservations(requestOptions = {}) {
      const body = await requestJson(url('/api/observations'), requestOptions, fetchImpl)
      const result = parseObservationList(body)
      if (result.status === 'invalid') throw invalidResponse(result.issues)
      const { summaries, issues } = await withDensity(result.data, (id) =>
        cachedDetail(id, requestOptions.signal),
      )
      return { data: summaries, issues: [...result.issues, ...issues] }
    },

    getObservation,

    async createObservation(input: CreateObservationInput, uploadOptions = {}) {
      const form = new FormData()
      form.append('file', input.file, input.file.name)
      form.append('source', input.source)
      // An empty region is left out: the service then names the result after its location.
      if (input.region.trim()) form.append('region', input.region.trim())
      form.append('capturedAt', input.capturedAt)
      // input.bounds is not sent: the service refuses files without georeferencing (NO_GEOREF).
      const { status, body } = await upload({
        url: url('/api/observations'),
        form,
        signal: uploadOptions.signal,
        onProgress: uploadOptions.onUploadProgress,
      })
      if (status < 200 || status >= 300) throw errorFromResponse(status, body)
      const parsed = CreatedSchema.safeParse(body)
      if (!parsed.success) throw invalidResponse([{ path: 'jobId', message: 'Missing' }], status)
      uploadOptions.onUploadProgress?.(100)
      return { jobId: parsed.data.jobId }
    },

    async getJob(jobId, requestOptions = {}) {
      const body = await requestJson(
        url(`/api/jobs/${encodeURIComponent(jobId)}`),
        requestOptions,
        fetchImpl,
      )
      const parsed = JobSchema.safeParse(body)
      if (!parsed.success) {
        throw invalidResponse(
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        )
      }
      return parsed.data
    },

    async health(requestOptions = {}): Promise<HealthStatus> {
      const body = await requestJson(url('/health'), requestOptions, fetchImpl)
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
