import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MODEL_CARD } from '@/lib/config'
import { ENV } from '@/lib/env'
import { computeJobState, pipelineDurationMs, UPLOAD_SHARE } from '../mock/pipeline'
import { getSampleObservation, getSampleObservations, pickSampleIdForUpload } from '../mock/samples'
import { getMockScenario, type MockScenario } from '../mock/scenario'
import { parseObservation, parseObservationList } from '../schemas'
import type { Observation, ObservationSource, ObservationSummary } from '../types'
import { ApiError, networkError } from './errors'
import type { CreateObservationInput, Job, ObservationsApi, Validated } from './types'

export interface MockApiOptions {
  /** Delay range for list and get calls, ms. Default 250 to 600 so loading states are visible. */
  latencyMs?: readonly [number, number]
  /** Delay range for job polling and health, ms. */
  pollLatencyMs?: readonly [number, number]
  /** Full pipeline duration, ms. Default 8000, or 2000 with VITE_DEMO_FAST=true. */
  pipelineDurationMs?: number
  now?: () => number
  scenario?: () => MockScenario
  random?: () => number
}

interface MockJob {
  id: string
  createdAt: number
  totalMs: number
  scenario: MockScenario
  fileName: string
  source: ObservationSource
  region: string
  capturedAt: string
  observationId?: string
}

function abortError(): DOMException {
  return new DOMException('The request was cancelled.', 'AbortError')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function toSummary({ detections, ...rest }: Observation): ObservationSummary {
  return { ...rest, detectionCount: detections.length }
}

function stripExtension(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '').trim()
  return base === '' ? fileName : base
}

function cloneObservation(observation: Observation): Observation {
  return JSON.parse(JSON.stringify(observation)) as Observation
}

function invalidResponse(issues: { path: string; message: string }[]): ApiError {
  const first = issues[0]
  return new ApiError(
    `The service returned data this app cannot read${first ? ` (${first.path || 'response'}: ${first.message})` : ''}. Try again later.`,
    { status: 502, code: 'INVALID_RESPONSE' },
  )
}

/**
 * In-browser backend built on the six sample observations and a simulated pipeline.
 * Responses go through the same zod validation the HTTP client will use.
 */
export function createMockApi(options: MockApiOptions = {}): ObservationsApi {
  const latency = options.latencyMs ?? [250, 600]
  const pollLatency = options.pollLatencyMs ?? [40, 120]
  const totalMs = options.pipelineDurationMs ?? pipelineDurationMs(ENV.demoFast)
  const now = options.now ?? (() => Date.now())
  const currentScenario = options.scenario ?? getMockScenario
  const random = options.random ?? Math.random

  const jobs = new Map<string, MockJob>()
  /** Observations created by simulated uploads, newest first. */
  const uploads: Observation[] = []
  let jobCounter = 0

  const delay = ([min, max]: readonly [number, number], signal?: AbortSignal) =>
    sleep(min + (max - min) * random(), signal)

  async function respond<T>(
    range: readonly [number, number],
    signal: AbortSignal | undefined,
    produce: () => T,
  ): Promise<T> {
    await delay(range, signal)
    if (currentScenario() === 'network') throw networkError()
    return produce()
  }

  function findObservation(id: string): Observation | undefined {
    return uploads.find((o) => o.id === id) ?? getSampleObservation(id)
  }

  function materialize(job: MockJob): string {
    const sampleId = pickSampleIdForUpload(job)
    const sample = getSampleObservation(sampleId)
    if (!sample) throw new Error(`Sample ${sampleId} is missing.`)
    const id = `obs-upload-${job.id.replace(/^job-/, '')}`
    const observation = cloneObservation(sample)
    observation.id = id
    observation.name = stripExtension(job.fileName)
    observation.region = job.region
    observation.capturedAt = job.capturedAt
    observation.source = job.source
    observation.detections = observation.detections.map((detection, index) => ({
      ...detection,
      id: `${id}-d${String(index + 1).padStart(3, '0')}`,
    }))
    observation.processing = {
      startedAt: new Date(job.createdAt).toISOString(),
      finishedAt: new Date(job.createdAt + job.totalMs).toISOString(),
      modelName: MODEL_CARD.name,
      modelVersion: MODEL_CARD.version,
    }
    uploads.unshift(observation)
    return id
  }

  return {
    listObservations: ({ signal } = {}) =>
      respond(latency, signal, (): Validated<ObservationSummary[]> => {
        // The "empty" scenario stands for a fresh install: only this session's uploads.
        const samples = currentScenario() === 'empty' ? [] : getSampleObservations()
        const all = [...uploads, ...samples].map(toSummary)
        const result = parseObservationList(all)
        if (result.status === 'invalid') throw invalidResponse(result.issues)
        return { data: result.data, issues: result.issues }
      }),

    getObservation: (id, { signal } = {}) =>
      respond(latency, signal, (): Validated<Observation> => {
        const observation = findObservation(id)
        if (!observation) {
          throw new ApiError(
            `Observation ${id} was not found. It may have been removed. Go back to the observation list and pick another.`,
            { status: 404, code: 'NOT_FOUND' },
          )
        }
        const result = parseObservation(observation)
        if (result.status === 'invalid') throw invalidResponse(result.issues)
        return { data: result.data, issues: result.issues }
      }),

    async createObservation(input: CreateObservationInput, { signal, onUploadProgress } = {}) {
      if (signal?.aborted) throw abortError()
      const scenario = currentScenario()
      if (scenario === 'network') {
        await delay(latency, signal)
        throw networkError()
      }
      if (input.file.size > MAX_UPLOAD_BYTES) {
        await delay(latency, signal)
        throw new ApiError(
          `The file is larger than ${MAX_UPLOAD_MB} MB. Crop or compress the image and upload it again.`,
          { status: 413, code: 'FILE_TOO_LARGE' },
        )
      }

      jobCounter += 1
      const job: MockJob = {
        id: `job-${String(jobCounter).padStart(4, '0')}`,
        createdAt: now(),
        totalMs,
        scenario,
        fileName: input.file.name,
        source: input.source,
        region: input.region,
        capturedAt: input.capturedAt,
      }
      jobs.set(job.id, job)

      const uploadMs = totalMs * UPLOAD_SHARE
      const ticks = Math.max(4, Math.round(uploadMs / 120))
      try {
        onUploadProgress?.(0)
        for (let tick = 1; tick <= ticks; tick++) {
          await sleep(uploadMs / ticks, signal)
          onUploadProgress?.(Math.round((tick / ticks) * 100))
        }
      } catch (error) {
        jobs.delete(job.id)
        throw error
      }
      return { jobId: job.id }
    },

    getJob: (jobId, { signal } = {}) =>
      respond(pollLatency, signal, (): Job => {
        const job = jobs.get(jobId)
        if (!job) {
          throw new ApiError(`Analysis job ${jobId} was not found. Start a new analysis.`, {
            status: 404,
            code: 'NOT_FOUND',
          })
        }
        const snapshot = computeJobState(now() - job.createdAt, job.totalMs, job.scenario)
        if (snapshot.status === 'completed' && !job.observationId) {
          job.observationId = materialize(job)
        }
        return {
          jobId,
          ...snapshot,
          ...(snapshot.status === 'completed' && job.observationId
            ? { observationId: job.observationId }
            : {}),
        }
      }),

    health: ({ signal } = {}) =>
      respond(pollLatency, signal, () => ({
        ok: true,
        mode: 'mock' as const,
        modelName: MODEL_CARD.name,
        modelVersion: MODEL_CARD.version,
      })),
  }
}
