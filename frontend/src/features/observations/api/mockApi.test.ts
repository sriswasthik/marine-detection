import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_IDS } from '../mock/samples'
import type { MockScenario } from '../mock/scenario'
import { ApiError } from './errors'
import { createMockApi } from './mockApi'
import type { CreateObservationInput, Job, ObservationsApi } from './types'

const DURATION = 1000

function setup(initial: MockScenario = 'success') {
  let scenario = initial
  const api = createMockApi({
    latencyMs: [0, 0],
    pollLatencyMs: [0, 0],
    pipelineDurationMs: DURATION,
    scenario: () => scenario,
  })
  return { api, setScenario: (next: MockScenario) => (scenario = next) }
}

function input(overrides: Partial<CreateObservationInput> = {}): CreateObservationInput {
  return {
    file: new File(['x'], 'harbour-pass.tif', { type: 'image/tiff' }),
    source: 'satellite',
    region: 'Chennai harbour approach',
    capturedAt: '2026-10-06T05:00:00Z',
    ...overrides,
  }
}

async function settle<T>(promise: Promise<T>, ms = 0): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms)
  return promise
}

/** Attaches the rejection handler before advancing timers, so nothing goes unhandled. */
async function settleError(promise: Promise<unknown>, ms = 0): Promise<unknown> {
  const caught = promise.then(
    () => new Error('Expected the request to fail'),
    (error: unknown) => error,
  )
  await vi.advanceTimersByTimeAsync(ms)
  return caught
}

async function startJob(
  api: ObservationsApi,
  data = input(),
  onUploadProgress?: (p: number) => void,
) {
  const created = api.createObservation(data, { onUploadProgress })
  return settle(created, DURATION * 0.2 + 50)
}

async function pollUntilDone(api: ObservationsApi, jobId: string): Promise<Job[]> {
  const seen: Job[] = []
  for (let i = 0; i < 40; i++) {
    const job = await settle(api.getJob(jobId))
    seen.push(job)
    if (job.status === 'completed' || job.status === 'failed') break
    await vi.advanceTimersByTimeAsync(100)
  }
  return seen
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('mock api reads', () => {
  it('lists six validated sample summaries without detections', async () => {
    const { api } = setup()
    const { data, issues } = await settle(api.listObservations())
    expect(issues).toEqual([])
    expect(data).toHaveLength(6)
    expect(data[0]).not.toHaveProperty('detections')
    expect(data.find((o) => o.id === SAMPLE_IDS.ennore)?.detectionCount).toBeGreaterThan(50)
    expect(data.find((o) => o.id === SAMPLE_IDS.mannar)?.detectionCount).toBe(0)
  })

  it('returns one observation with detections', async () => {
    const { api } = setup()
    const { data } = await settle(api.getObservation(SAMPLE_IDS.mahim))
    expect(data.source).toBe('drone')
    expect(data.detections.length).toBeGreaterThan(0)
  })

  it('rejects unknown ids with a 404 ApiError', async () => {
    const { api } = setup()
    const error = await settleError(api.getObservation('missing'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('waits the configured latency', async () => {
    let resolved = false
    const api = createMockApi({ latencyMs: [300, 300], scenario: () => 'success' })
    void api.listObservations().then(() => (resolved = true))
    await vi.advanceTimersByTimeAsync(250)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(resolved).toBe(true)
  })

  it('reports health in mock mode', async () => {
    const { api } = setup()
    expect(await settle(api.health())).toMatchObject({ ok: true, mode: 'mock' })
  })
})

describe('mock pipeline', () => {
  it('reports upload progress up to 100 and returns a job id', async () => {
    const { api } = setup()
    const progress: number[] = []
    const { jobId } = await startJob(api, input(), (p) => progress.push(p))
    expect(jobId).toMatch(/^job-\d{4}$/)
    expect(progress[0]).toBe(0)
    expect(progress[progress.length - 1]).toBe(100)
    expect([...progress].sort((a, b) => a - b)).toEqual(progress)
  })

  it('runs to completion and stores a new observation with the user metadata', async () => {
    const { api } = setup()
    const { jobId } = await startJob(api)
    const jobs = await pollUntilDone(api, jobId)
    const last = jobs[jobs.length - 1]
    expect(last?.status).toBe('completed')
    expect(last?.progress).toBe(100)
    expect(jobs.some((j) => j.step === 'detect')).toBe(true)
    expect(jobs.every((j, i) => i === 0 || j.progress >= (jobs[i - 1]?.progress ?? 0))).toBe(true)

    const observationId = last?.observationId ?? ''
    const { data } = await settle(api.getObservation(observationId))
    expect(data.region).toBe('Chennai harbour approach')
    expect(data.capturedAt).toBe('2026-10-06T05:00:00Z')
    expect(data.name).toBe('harbour-pass')
    expect(data.detections.length).toBeGreaterThan(50)
    expect(data.detections.every((d) => d.id.startsWith(observationId))).toBe(true)

    const list = await settle(api.listObservations())
    expect(list.data[0]?.id).toBe(observationId)
    expect(list.data).toHaveLength(7)
  })

  it('resolves to the zero-detection result for "nodebris"', async () => {
    const { api } = setup('nodebris')
    const { jobId } = await startJob(api)
    const last = (await pollUntilDone(api, jobId)).at(-1)
    const { data } = await settle(api.getObservation(last?.observationId ?? ''))
    expect(data.detections).toEqual([])
    expect(data.densityLevel).toBeNull()
  })

  it('fails at upload for "invalid"', async () => {
    const { api } = setup('invalid')
    const { jobId } = await startJob(api)
    const last = (await pollUntilDone(api, jobId)).at(-1)
    expect(last).toMatchObject({ status: 'failed', step: 'upload', error: { recoverable: true } })
    expect(last?.observationId).toBeUndefined()
  })

  it('fails during detection for "modelfail"', async () => {
    const { api } = setup('modelfail')
    const { jobId } = await startJob(api)
    const last = (await pollUntilDone(api, jobId)).at(-1)
    expect(last).toMatchObject({ status: 'failed', step: 'detect', error: { code: 'MODEL_ERROR' } })
  })

  it('keeps the scenario a job started with', async () => {
    const { api, setScenario } = setup('modelfail')
    const { jobId } = await startJob(api)
    setScenario('success')
    expect((await pollUntilDone(api, jobId)).at(-1)?.status).toBe('failed')
  })

  it('rejects files over the size limit with a 413', async () => {
    const { api } = setup()
    const file = new File(['x'], 'huge.tif')
    Object.defineProperty(file, 'size', { value: 101 * 1024 * 1024 })
    const error = await settleError(api.createObservation(input({ file })))
    expect(error).toMatchObject({ status: 413, code: 'FILE_TOO_LARGE' })
  })

  it('cancels an upload when aborted', async () => {
    const { api } = setup()
    const controller = new AbortController()
    const pending = api
      .createObservation(input(), { signal: controller.signal })
      .catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(50)
    controller.abort()
    const error = await pending
    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')
  })

  it('rejects unknown job ids with a 404', async () => {
    const { api } = setup()
    const error = await settleError(api.getJob('job-9999'))
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })
})

describe('network scenario', () => {
  it('rejects every request with a network error', async () => {
    const { api } = setup('network')
    const calls: Promise<unknown>[] = [
      api.listObservations(),
      api.getObservation(SAMPLE_IDS.ennore),
      api.createObservation(input()),
      api.getJob('job-0001'),
      api.health(),
    ].map((p) => p.catch((e: unknown) => e))
    await vi.advanceTimersByTimeAsync(10)
    for (const result of await Promise.all(calls)) {
      expect(result).toBeInstanceOf(ApiError)
      expect(result).toMatchObject({ status: null, code: 'NETWORK_ERROR' })
    }
  })
})
