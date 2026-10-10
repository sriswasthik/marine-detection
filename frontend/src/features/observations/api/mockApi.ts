import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, MODEL_CARD } from '@/lib/config'
import { ENV } from '@/lib/env'
import { computeJobState, pipelineDurationMs, UPLOAD_SHARE } from '../mock/pipeline'
import { loadRealSamples, type RealSampleLoader } from '../mock/realSamples'
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
  /** Real model output from public/samples. Default: fetched once per page load. */
  realSamples?: RealSampleLoader
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

function toSummary({ detections, densityGrid: _grid, ...rest }: Observation): ObservationSummary {
  return { ...rest, detectionCount: detections.length }
}

/** Renames detection ids everywhere they appear: detections, the service grid and hotspots. */
function renameDetections(observation: Observation, rename: (id: string) => string): void {
  observation.detections = observation.detections.map((d) => ({ ...d, id: rename(d.id) }))
  if (observation.densityGrid) {
    observation.densityGrid.cells = observation.densityGrid.cells.map((cell) => ({
      ...cell,
      detectionAreasM2: Object.fromEntries(
        Object.entries(cell.detectionAreasM2).map(([id, area]) => [rename(id), area]),
      ),
    }))
  }
  if (observation.hotspots) {
    observation.hotspots = observation.hotspots.map((hotspot) => ({
      ...hotspot,
      detectionIds: hotspot.detectionIds.map(rename).sort(),
    }))
  }
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
 * In-browser backend built on the six synthetic sample observations, the real model output in
 * public/samples (see ../mock/realSamples.ts) and a simulated pipeline. Responses go through the
 * same zod validation the HTTP client will use.
 */
export function createMockApi(options: MockApiOptions = {}): ObservationsApi {
  const latency = options.latencyMs ?? [250, 600]
  const pollLatency = options.pollLatencyMs ?? [40, 120]
  const totalMs = options.pipelineDurationMs ?? pipelineDurationMs(ENV.demoFast)
  const now = options.now ?? (() => Date.now())
  const currentScenario = options.scenario ?? getMockScenario
  const random = options.random ?? Math.random
  const loadReal = options.realSamples ?? loadRealSamples
  /** The last loaded real samples, so a finished job can pick one synchronously. */
  let realSamples: Observation[] = []
  async function currentRealSamples(): Promise<Observation[]> {
    realSamples = await loadReal()
    return realSamples
  }

  const jobs = new Map<string, MockJob>()
  /** Observations created by simulated uploads, newest first. */
  const uploads: Observation[] = []
  let jobCounter = 0

  const delay = ([min, max]: readonly [number, number], signal?: AbortSignal) =>
    sleep(min + (max - min) * random(), signal)

  async function respond<T>(
    range: readonly [number, number],
    signal: AbortSignal | undefined,
    produce: () => T | Promise<T>,
  ): Promise<T> {
    await delay(range, signal)
    if (currentScenario() === 'network') throw networkError()
    return produce()
  }

  async function findObservation(id: string): Promise<Observation | undefined> {
    return (
      uploads.find((o) => o.id === id) ??
      getSampleObservation(id) ??
      (await currentRealSamples()).find((o) => o.id === id)
    )
  }

  function materialize(job: MockJob): string {
    // An uploaded MARIDA patch that was exported gets its real model output; anything else
    // copies a synthetic sample.
    const real =
      job.scenario === 'success'
        ? realSamples.find((o) => o.id === stripExtension(job.fileName))
        : undefined
    const sampleId = real ? real.id : pickSampleIdForUpload(job)
    const sample = real ?? getSampleObservation(sampleId)
    if (!sample) throw new Error(`Sample ${sampleId} is missing.`)
    const id = `obs-upload-${job.id.replace(/^job-/, '')}`
    const observation = cloneObservation(sample)
    observation.id = id
    observation.name = stripExtension(job.fileName)
    // Like the service, an empty region keeps the scene's own place name.
    observation.region = job.region.trim() || sample.region
    observation.capturedAt = job.capturedAt
    observation.source = job.source
    const newIds = new Map(
      observation.detections.map((d, index) => [
        d.id,
        `${id}-d${String(index + 1).padStart(3, '0')}`,
      ]),
    )
    renameDetections(observation, (old) => newIds.get(old) ?? old)
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
      respond(latency, signal, async (): Promise<Validated<ObservationSummary[]>> => {
        // The "empty" scenario stands for a fresh install: only this session's uploads.
        const empty = currentScenario() === 'empty'
        const samples = empty ? [] : getSampleObservations()
        const real = empty ? [] : await currentRealSamples()
        const all = [...uploads, ...samples, ...real].map(toSummary)
        const result = parseObservationList(all)
        if (result.status === 'invalid') throw invalidResponse(result.issues)
        return { data: result.data, issues: result.issues }
      }),

    getObservation: (id, { signal } = {}) =>
      respond(latency, signal, async (): Promise<Validated<Observation>> => {
        const observation = await findObservation(id)
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

      await currentRealSamples()
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

    // Phase 3 Mock Implementations
    getReviews: (observationId, { signal } = {}) =>
      respond(latency, signal, async () => ({
        data: observationId ? mockReviews.filter((r) => r.observationId === observationId) : mockReviews,
        issues: [],
      })),

    getReviewSummary: ({ signal } = {}) =>
      respond(latency, signal, async () => {
        const total = mockReviews.length
        const confirmed = mockReviews.filter((r) => r.status === 'confirmed').length
        const falsePositive = mockReviews.filter((r) => r.status === 'false_positive').length
        const uncertain = mockReviews.filter((r) => r.status === 'uncertain').length
        return { total, unreviewed: Math.max(0, 10 - total), confirmed, falsePositive, uncertain }
      }),

    saveReview: (review, { signal } = {}) =>
      respond(latency, signal, async () => {
        const existingIdx = mockReviews.findIndex(
          (r) => r.observationId === review.observationId && r.detectionId === review.detectionId,
        )
        const record = {
          id: existingIdx >= 0 ? mockReviews[existingIdx].id : `rev-${Date.now()}`,
          observationId: review.observationId,
          detectionId: review.detectionId,
          status: review.status,
          notes: review.notes,
          reviewerId: review.reviewerId || 'analyst-1',
          createdAt: existingIdx >= 0 ? mockReviews[existingIdx].createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        if (existingIdx >= 0) mockReviews[existingIdx] = record
        else mockReviews.push(record)
        return record
      }),

    listMonitoringAreas: ({ signal } = {}) =>
      respond(latency, signal, async () => ({
        data: mockMonitoringAreas,
        issues: [],
      })),

    getMonitoringArea: (id, { signal } = {}) =>
      respond(latency, signal, async () => {
        const area = mockMonitoringAreas.find((a) => a.id === id) || mockMonitoringAreas[0]
        return {
          data: {
            ...area,
            intersectingObservations: [],
          },
          issues: [],
        }
      }),

    createMonitoringArea: (areaInput, { signal } = {}) =>
      respond(latency, signal, async () => {
        const area = {
          id: `ma-${Date.now()}`,
          name: areaInput.name,
          description: areaInput.description,
          geometry: areaInput.geometry,
          crs: areaInput.crs || 'EPSG:4326',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          purpose: areaInput.purpose || 'Surveillance',
          status: 'active' as const,
          areaM2: 500000,
        }
        mockMonitoringAreas.push(area)
        return area
      }),

    updateMonitoringArea: (id, update, { signal } = {}) =>
      respond(latency, signal, async () => {
        const area = mockMonitoringAreas.find((a) => a.id === id)
        if (!area) throw new Error('Monitoring area not found')
        Object.assign(area, update, { updatedAt: new Date().toISOString() })
        return area
      }),

    deleteMonitoringArea: (id, { signal } = {}) =>
      respond(latency, signal, async () => {
        const idx = mockMonitoringAreas.findIndex((a) => a.id === id)
        if (idx >= 0) mockMonitoringAreas.splice(idx, 1)
        return { ok: true }
      }),

    compareObservations: (input, { signal } = {}) =>
      respond(latency, signal, async () => ({
        baselineObservationId: input.baselineObservationId,
        comparisonObservationId: input.comparisonObservationId,
        comparability: { status: 'directly_comparable' as const, warnings: [] },
        baselineDebrisAreaM2: 12500,
        comparisonDebrisAreaM2: 15400,
        areaDifferenceM2: 2900,
        percentChange: 23.2,
        baselineDetectionCount: 4,
        comparisonDetectionCount: 5,
        baselineHotspotCount: 1,
        comparisonHotspotCount: 2,
        spatialMatches: [
          { baselineDetectionId: 'd1', comparisonDetectionId: 'd10', iou: 0.82, matchType: 'overlapping' as const },
          { comparisonDetectionId: 'd11', iou: 0, matchType: 'newly_detected' as const },
        ],
        timestamp: new Date().toISOString(),
      })),

    getQualityOverlays: (_id, { signal } = {}) =>
      respond(latency, signal, async () => ({
        validCoverage: true,
        cloudCoveragePercent: 5.2,
        noDataMask: null,
      })),

  }
}

const mockReviews: any[] = []
const mockMonitoringAreas: any[] = [
  {
    id: 'ma-sample-1',
    name: 'North Pacific Gyre Sector Alpha',
    description: 'High-density plastic accumulation monitoring zone',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-150.5, 25.5],
          [-149.5, 25.5],
          [-149.5, 26.5],
          [-150.5, 26.5],
          [-150.5, 25.5],
        ],
      ],
    },
    crs: 'EPSG:4326',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    purpose: 'Marine Debris Watch',
    status: 'active',
    areaM2: 12500000000,
  },
]

