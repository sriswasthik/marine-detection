import { describe, expect, it } from 'vitest'
import { JOB_STEPS } from '../api/types'
import {
  computeJobState,
  pipelineDurationMs,
  PIPELINE_DURATION_FAST_MS,
  PIPELINE_DURATION_MS,
} from './pipeline'

const TOTAL = 8000

describe('computeJobState', () => {
  it('walks upload, preprocess, detect, map in order with rising progress', () => {
    let lastProgress = -1
    let lastStepIndex = 0
    for (let t = 0; t < TOTAL; t += 50) {
      const state = computeJobState(t, TOTAL, 'success')
      expect(state.status).toBe('running')
      expect(state.progress).toBeGreaterThanOrEqual(lastProgress)
      expect(state.progress).toBeLessThan(100)
      const stepIndex = JOB_STEPS.indexOf(state.step)
      expect(stepIndex).toBeGreaterThanOrEqual(lastStepIndex)
      lastProgress = state.progress
      lastStepIndex = stepIndex
    }
    expect(lastStepIndex).toBe(JOB_STEPS.indexOf('map'))
  })

  it('visits every step', () => {
    const steps = new Set<string>()
    for (let t = 0; t < TOTAL; t += 100) steps.add(computeJobState(t, TOTAL, 'success').step)
    expect([...steps]).toEqual([...JOB_STEPS])
  })

  it('completes at the full duration', () => {
    expect(computeJobState(TOTAL, TOTAL, 'success')).toEqual({
      status: 'completed',
      step: 'map',
      progress: 100,
    })
    expect(computeJobState(TOTAL * 3, TOTAL, 'nodebris').status).toBe('completed')
  })

  it('treats negative elapsed time as the start', () => {
    expect(computeJobState(-500, TOTAL, 'success')).toEqual({
      status: 'running',
      step: 'upload',
      progress: 0,
    })
  })

  it('fails at upload with a recoverable validation error for "invalid"', () => {
    expect(computeJobState(TOTAL * 0.1, TOTAL, 'invalid').status).toBe('running')
    const failed = computeJobState(TOTAL * 0.25, TOTAL, 'invalid')
    expect(failed.status).toBe('failed')
    expect(failed.step).toBe('upload')
    expect(failed.error).toMatchObject({ code: 'INVALID_IMAGE', recoverable: true })
    expect(computeJobState(TOTAL * 5, TOTAL, 'invalid').status).toBe('failed')
  })

  it('fails during detection with a recoverable server error for "modelfail"', () => {
    expect(computeJobState(TOTAL * 0.5, TOTAL, 'modelfail').status).toBe('running')
    const failed = computeJobState(TOTAL * 0.7, TOTAL, 'modelfail')
    expect(failed.status).toBe('failed')
    expect(failed.step).toBe('detect')
    expect(failed.progress).toBeGreaterThan(33)
    expect(failed.progress).toBeLessThan(88)
    expect(failed.error).toMatchObject({ code: 'MODEL_ERROR', recoverable: true })
  })

  it('has plain error messages that say what to do next', () => {
    const { error } = computeJobState(TOTAL, TOTAL, 'modelfail')
    expect(error?.message).toMatch(/Try again/)
    expect(error?.message).not.toMatch(/!/)
  })

  it('shortens the pipeline in fast demo mode', () => {
    expect(pipelineDurationMs(false)).toBe(PIPELINE_DURATION_MS)
    expect(pipelineDurationMs(true)).toBe(PIPELINE_DURATION_FAST_MS)
  })
})
