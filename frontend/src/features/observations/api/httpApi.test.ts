import { describe, expect, it, vi } from 'vitest'
import { failureFromError, failureFromJob } from '@/features/analyze/runReducer'
import { toAppError } from '@/lib/errors/appError'
import { getSampleObservation, HERO_SAMPLE_ID, SAMPLE_IDS } from '../mock/samples'
import type { Observation } from '../types'
import { ApiError } from './errors'
import { createHttpApi, errorFromResponse, type UploadRequest } from './httpApi'

const BASE = 'http://api.test'

/** A sample as the service sends it: density left to the frontend. */
function fromService(id: string): Observation {
  const sample = getSampleObservation(id)
  if (!sample) throw new Error(`Missing sample ${id}`)
  const copy = JSON.parse(JSON.stringify(sample)) as Observation
  return {
    ...copy,
    densityLevel: null,
    detections: copy.detections.map((d) => ({ ...d, densityLevel: null })),
  } as unknown as Observation
}

function summaryOf({ detections, ...rest }: Observation) {
  return { ...rest, detectionCount: detections.length }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function fakeService(routes: Record<string, () => Response>) {
  const calls: string[] = []
  const fetchImpl = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url.replace(BASE, ''))
    const route = routes[url.replace(BASE, '')]
    return Promise.resolve(
      route
        ? route()
        : json({ error: { code: 'NOT_FOUND', message: 'Nothing here.', recoverable: false } }, 404),
    )
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
}

const hero = fromService(HERO_SAMPLE_ID)
const mannar = fromService(SAMPLE_IDS.mannar)

describe('HTTP client: reads', () => {
  it('reads health', async () => {
    const { fetchImpl } = fakeService({
      '/health': () =>
        json({
          status: 'ok',
          ok: true,
          modelName: 'U-Net',
          modelVersion: 'f19c947d5a0a',
          device: 'cpu',
        }),
    })
    const health = await createHttpApi(`${BASE}/`, { fetchImpl }).health()
    expect(health).toEqual({
      ok: true,
      mode: 'http',
      modelName: 'U-Net',
      modelVersion: 'f19c947d5a0a',
    })
  })

  it('fills density levels the service leaves null, on detail and in the list', async () => {
    const { fetchImpl, calls } = fakeService({
      '/api/observations': () => json([summaryOf(hero), summaryOf(mannar)]),
      [`/api/observations/${hero.id}`]: () => json(hero),
    })
    const api = createHttpApi(BASE, { fetchImpl })
    const detail = await api.getObservation(hero.id)
    expect(detail.issues).toEqual([])
    expect(detail.data.densityLevel).toBe('critical')
    expect(detail.data.detections.every((d) => d.densityLevel !== null)).toBe(true)

    const list = await api.listObservations()
    expect(list.issues).toEqual([])
    expect(list.data.map((o) => o.densityLevel)).toEqual(['critical', null])
    // The hero's detail was cached, and the no-debris scene needs none.
    expect(calls.filter((c) => c.startsWith('/api/observations/'))).toHaveLength(1)
  })

  it('reports a level it could not load as partial data, not as "no debris"', async () => {
    const { fetchImpl } = fakeService({
      '/api/observations': () => json([summaryOf(hero)]),
      [`/api/observations/${hero.id}`]: () =>
        json({ error: { code: 'SERVER_ERROR', message: 'x' } }, 500),
    })
    const list = await createHttpApi(BASE, { fetchImpl }).listObservations()
    expect(list.data[0]?.densityLevel).toBeNull()
    expect(list.issues).toEqual([
      { path: '0.densityLevel', message: 'Density level could not be loaded' },
    ])
  })

  it('turns a 404 body into NOT_FOUND', async () => {
    const { fetchImpl } = fakeService({})
    const error = await createHttpApi(BASE, { fetchImpl })
      .getObservation('nope')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND' })
    expect(toAppError(error).code).toBe('NOT_FOUND')
  })

  it('rejects malformed data and unreachable services with typed errors', async () => {
    const bad = fakeService({ '/api/observations': () => json({ items: [] }) })
    await expect(createHttpApi(BASE, bad).listObservations()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    const down = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(
      createHttpApi(BASE, { fetchImpl: down as unknown as typeof fetch }).health(),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: null })
  })
})

describe('HTTP client: analysis', () => {
  const file = new File([new Uint8Array([0x49, 0x49, 0x2a, 0x00])], 'S2_patch.tif', {
    type: 'image/tiff',
  })
  const input = {
    file,
    source: 'satellite' as const,
    region: 'Haiti',
    capturedAt: '2020-12-22T15:30:00.000Z',
  }

  it('uploads the form with progress and returns the job id', async () => {
    let sent: UploadRequest | null = null
    const upload = vi.fn((request: UploadRequest) => {
      sent = request
      request.onProgress?.(40)
      return Promise.resolve({ status: 202, body: { jobId: 'job-1' } })
    })
    const progress: number[] = []
    const result = await createHttpApi(BASE, { upload }).createObservation(input, {
      onUploadProgress: (p) => progress.push(p),
    })
    expect(result).toEqual({ jobId: 'job-1' })
    expect(progress).toEqual([40, 100])
    const request = sent as UploadRequest | null
    expect(request?.url).toBe(`${BASE}/api/observations`)
    expect(request?.form.get('source')).toBe('satellite')
    expect(request?.form.get('region')).toBe('Haiti')
    expect(request?.form.get('capturedAt')).toBe('2020-12-22T15:30:00.000Z')
    expect((request?.form.get('file') as File).name).toBe('S2_patch.tif')
  })

  it('leaves an empty region out, so the service names the result', async () => {
    let form: FormData | null = null
    const upload = (request: UploadRequest) => {
      form = request.form
      return Promise.resolve({ status: 202, body: { jobId: 'job-1' } })
    }
    await createHttpApi(BASE, { upload }).createObservation({ ...input, region: '  ' })
    expect((form as FormData | null)?.has('region')).toBe(false)
  })

  it('maps a refused file to an invalid-image failure the user can fix', async () => {
    const upload = () =>
      Promise.resolve({
        status: 422,
        body: {
          error: { code: 'INVALID_BANDS', message: 'The image has 3 bands.', recoverable: true },
        },
      })
    const error = await createHttpApi(BASE, { upload })
      .createObservation(input)
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 422, code: 'INVALID_BANDS' })
    const appError = toAppError(error)
    expect(appError.code).toBe('INVALID_IMAGE')
    expect(appError.reference).toBe('INVALID_BANDS, HTTP 422')
    expect(failureFromError(error)?.kind).toBe('invalid')
    expect(
      toAppError(errorFromResponse(422, { error: { code: 'TOO_LARGE', message: '' } })).code,
    ).toBe('FILE_TOO_LARGE')
  })

  it('reads job progress and typed job failures', async () => {
    const { fetchImpl } = fakeService({
      '/api/jobs/job-1': () =>
        json({ jobId: 'job-1', status: 'running', step: 'detect', progress: 40 }),
      '/api/jobs/job-2': () =>
        json({
          jobId: 'job-2',
          status: 'failed',
          step: 'detect',
          progress: 40,
          error: { code: 'MODEL_FAILURE', message: 'Stopped.', recoverable: true },
        }),
      '/api/jobs/job-3': () =>
        json({ jobId: 'job-3', status: 'exploded', step: 'map', progress: 5 }),
    })
    const api = createHttpApi(BASE, { fetchImpl })
    expect(await api.getJob('job-1')).toEqual({
      jobId: 'job-1',
      status: 'running',
      step: 'detect',
      progress: 40,
    })
    const failed = await api.getJob('job-2')
    expect(failureFromJob(failed)).toMatchObject({ kind: 'server', code: 'MODEL_FAILED' })
    await expect(api.getJob('job-3')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
