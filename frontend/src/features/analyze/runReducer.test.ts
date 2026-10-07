import { describe, expect, it } from 'vitest'
import {
  ApiError,
  networkError,
  offlineError,
  timeoutError,
} from '@/features/observations/api/errors'
import { ERROR_COPY } from '@/lib/errors/errorCopy'
import type { Job } from '@/features/observations/api/types'
import {
  failureFromError,
  failureFromJob,
  IDLE_RUN,
  runReducer,
  stepStatuses,
  summaryText,
  type RunAction,
  type RunFailure,
  type RunState,
} from './runReducer'

const job = (patch: Partial<Job>): Job => ({
  jobId: 'job-1',
  status: 'running',
  step: 'preprocess',
  progress: 25,
  ...patch,
})
const run = (actions: RunAction[], from: RunState = IDLE_RUN) => actions.reduce(runReducer, from)
const failure: RunFailure = { kind: 'server', title: 'x', message: 'y', code: null }
const started = run([{ type: 'start', at: 1000 }])

describe('runReducer', () => {
  it('starts on the upload step', () => {
    expect(started).toEqual({
      phase: 'running',
      step: 'upload',
      uploadPercent: 0,
      progress: 0,
      startedAt: 1000,
      jobId: null,
    })
  })

  it('tracks upload progress, never backwards and within 0..100', () => {
    const state = run(
      [
        { type: 'uploadProgress', percent: 40 },
        { type: 'uploadProgress', percent: 20 },
        { type: 'uploadProgress', percent: 140 },
      ],
      started,
    )
    expect(state).toMatchObject({ uploadPercent: 100 })
  })

  it('records the job and moves through steps only forwards', () => {
    const state = run(
      [
        { type: 'uploaded', jobId: 'job-1' },
        { type: 'jobUpdate', job: job({ step: 'detect', progress: 50 }) },
        { type: 'jobUpdate', job: job({ step: 'preprocess', progress: 30 }) },
      ],
      started,
    )
    expect(state).toMatchObject({ phase: 'running', jobId: 'job-1', step: 'detect', progress: 50 })
  })

  it('ignores upload progress once the upload step is over', () => {
    const state = run(
      [
        { type: 'jobUpdate', job: job({ step: 'detect' }) },
        { type: 'uploadProgress', percent: 10 },
      ],
      started,
    )
    expect(state).toMatchObject({ step: 'detect' })
  })

  it('succeeds with a summary and keeps the start time', () => {
    const state = run(
      [{ type: 'succeeded', observationId: 'obs-1', summary: null, at: 9000 }],
      started,
    )
    expect(state).toEqual({
      phase: 'succeeded',
      observationId: 'obs-1',
      summary: null,
      startedAt: 1000,
      finishedAt: 9000,
    })
  })

  it('fails on the current step unless a step is given', () => {
    const atDetect = run([{ type: 'jobUpdate', job: job({ step: 'detect' }) }], started)
    expect(run([{ type: 'failed', failure, at: 5 }], atDetect)).toMatchObject({
      phase: 'failed',
      step: 'detect',
    })
    expect(run([{ type: 'failed', failure, at: 5, step: 'map' }], atDetect)).toMatchObject({
      step: 'map',
    })
  })

  it('cancels a running job back to idle, and ignores late updates', () => {
    const cancelled = run([{ type: 'cancel' }], started)
    expect(cancelled).toBe(IDLE_RUN)
    const late = run(
      [
        { type: 'jobUpdate', job: job({ step: 'map' }) },
        { type: 'succeeded', observationId: 'x', summary: null, at: 1 },
        { type: 'failed', failure, at: 1 },
      ],
      cancelled,
    )
    expect(late).toBe(IDLE_RUN)
  })

  it('does not cancel a finished run, and resets from anywhere', () => {
    const done = run([{ type: 'succeeded', observationId: 'o', summary: null, at: 2 }], started)
    expect(runReducer(done, { type: 'cancel' })).toBe(done)
    expect(runReducer(done, { type: 'reset' })).toBe(IDLE_RUN)
  })

  it('starts again cleanly after a failure (retry)', () => {
    const failed = run([{ type: 'failed', failure, at: 2 }], started)
    expect(runReducer(failed, { type: 'start', at: 50 })).toMatchObject({
      phase: 'running',
      step: 'upload',
      startedAt: 50,
    })
  })
})

describe('stepStatuses', () => {
  it('is all pending when idle', () => {
    expect(Object.values(stepStatuses(IDLE_RUN))).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
    ])
  })

  it('marks earlier steps done and the current one active', () => {
    const state = run([{ type: 'jobUpdate', job: job({ step: 'detect' }) }], started)
    expect(stepStatuses(state)).toEqual({
      upload: 'done',
      preprocess: 'done',
      detect: 'active',
      map: 'pending',
    })
  })

  it('marks the failed step', () => {
    const state = run([{ type: 'failed', failure, at: 1, step: 'detect' }], started)
    expect(stepStatuses(state).detect).toBe('failed')
    expect(stepStatuses(state).map).toBe('pending')
  })

  it('marks every step done on success', () => {
    const state = run([{ type: 'succeeded', observationId: 'o', summary: null, at: 1 }], started)
    expect(new Set(Object.values(stepStatuses(state)))).toEqual(new Set(['done']))
  })
})

describe('failure wording', () => {
  it('reads an invalid image from the job, with the shared copy', () => {
    const result = failureFromJob(
      job({
        status: 'failed',
        step: 'upload',
        error: { code: 'INVALID_IMAGE', message: 'Not an image.', recoverable: true },
      }),
    )
    expect(result).toEqual({
      kind: 'invalid',
      title: ERROR_COPY.INVALID_IMAGE.title,
      message: ERROR_COPY.INVALID_IMAGE.message,
      code: 'INVALID_IMAGE',
    })
  })

  it('reads a model failure as "The detection step failed", only at the detection step', () => {
    const at = (step: Job['step']) =>
      failureFromJob(
        job({
          status: 'failed',
          step,
          error: { code: 'MODEL_ERROR', message: 'Stopped.', recoverable: true },
        }),
      )
    expect(at('detect')).toMatchObject({ kind: 'server', title: 'The detection step failed' })
    expect(at('map')).toMatchObject({ kind: 'server', code: 'SERVER' })
  })

  it('treats an upload failure without a code as an unusable file', () => {
    expect(failureFromJob(job({ status: 'failed', step: 'upload' }))).toMatchObject({
      kind: 'invalid',
    })
    expect(failureFromJob(job({ status: 'failed', step: 'preprocess' }))).toMatchObject({
      kind: 'server',
    })
  })

  it('classifies request errors', () => {
    expect(failureFromError(networkError())).toMatchObject({
      kind: 'network',
      title: "Can't reach the processing service",
    })
    expect(failureFromError(offlineError())).toMatchObject({
      kind: 'network',
      title: "You're offline",
    })
    expect(failureFromError(timeoutError(20_000))).toMatchObject({ kind: 'network' })
    expect(
      failureFromError(new ApiError('Too big.', { status: 413, code: 'FILE_TOO_LARGE' })),
    ).toMatchObject({ kind: 'invalid', code: 'FILE_TOO_LARGE' })
    expect(
      failureFromError(new ApiError('Down.', { status: 503, code: 'SERVER_ERROR' })),
    ).toMatchObject({ kind: 'server', code: 'SERVICE_UNAVAILABLE' })
    expect(failureFromError(new Error('boom'))).toMatchObject({ kind: 'server' })
    expect(failureFromError(new DOMException('stop', 'AbortError'))).toBeNull()
  })

  it('never passes on raw messages', () => {
    const result = failureFromError(new Error('TypeError: x is undefined at foo.ts:12'))
    expect(result?.message).not.toMatch(/undefined|foo\.ts/)
    expect(result?.title).not.toBe('Something went wrong')
  })
})

describe('summaryText', () => {
  it('words counts and the no-debris result', () => {
    expect(summaryText({ detectionCount: 42, hotspotCount: 3, notices: [] })).toBe(
      '42 regions detected, 3 hotspots',
    )
    expect(summaryText({ detectionCount: 1, hotspotCount: 1, notices: [] })).toBe(
      '1 region detected, 1 hotspot',
    )
    expect(summaryText({ detectionCount: 0, hotspotCount: 0, notices: [] })).toMatch(
      /^No debris detected/,
    )
    expect(summaryText(null)).toBe('Detection finished.')
  })
})
