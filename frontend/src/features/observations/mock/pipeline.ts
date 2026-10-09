import { MAX_UPLOAD_MB, MODEL_INPUT } from '@/lib/config'
import type { JobError, JobStatus, JobStep } from '../api/types'
import type { MockScenario } from './scenario'

export const PIPELINE_DURATION_MS = 8000
export const PIPELINE_DURATION_FAST_MS = 2000

export function pipelineDurationMs(demoFast: boolean): number {
  return demoFast ? PIPELINE_DURATION_FAST_MS : PIPELINE_DURATION_MS
}

interface StepTiming {
  step: JobStep
  /** Share of the total duration, 0 to 1. */
  from: number
  to: number
  /** Overall progress at the start and end of the step. */
  progressFrom: number
  progressTo: number
  ease: (t: number) => number
}

const linear = (t: number) => t
const easeOut = (t: number) => 1 - (1 - t) ** 2

/** Upload is quick, detection is the long step and slows as it nears the end. */
export const PIPELINE_TIMELINE: readonly StepTiming[] = [
  { step: 'upload', from: 0, to: 0.2, progressFrom: 0, progressTo: 20, ease: linear },
  { step: 'preprocess', from: 0.2, to: 0.36, progressFrom: 20, progressTo: 33, ease: linear },
  { step: 'detect', from: 0.36, to: 0.86, progressFrom: 33, progressTo: 88, ease: easeOut },
  { step: 'map', from: 0.86, to: 1, progressFrom: 88, progressTo: 99, ease: linear },
]

/** Share of the pipeline spent on upload; createObservation resolves when it ends. */
export const UPLOAD_SHARE = 0.2

/** Where each failing scenario stops, as a share of the total duration. */
export const MOCK_FAILURES: Readonly<
  Partial<Record<MockScenario, { at: number; step: JobStep; error: JobError }>>
> = {
  invalid: {
    at: UPLOAD_SHARE,
    step: 'upload',
    error: {
      code: 'INVALID_IMAGE',
      message: `The file could not be read as an ${MODEL_INPUT.bands}-band Sentinel-2 GeoTIFF with location data. Upload one under ${MAX_UPLOAD_MB} MB, or add the image bounds manually.`,
      recoverable: true,
    },
  },
  modelfail: {
    at: 0.62,
    step: 'detect',
    error: {
      code: 'MODEL_ERROR',
      message:
        'The detection model stopped before finishing. Try again. If it fails again, try a smaller image.',
      recoverable: true,
    },
  },
}

export interface JobSnapshot {
  status: JobStatus
  step: JobStep
  progress: number
  error?: JobError
}

function progressAt(fraction: number): { step: JobStep; progress: number } {
  const clamped = Math.min(Math.max(fraction, 0), 0.999999)
  const timing =
    PIPELINE_TIMELINE.find((t) => clamped >= t.from && clamped < t.to) ?? PIPELINE_TIMELINE[0]
  if (!timing) return { step: 'upload', progress: 0 }
  const local = (clamped - timing.from) / (timing.to - timing.from)
  const progress =
    timing.progressFrom + (timing.progressTo - timing.progressFrom) * timing.ease(local)
  return { step: timing.step, progress: Math.floor(progress) }
}

/**
 * Job state at a point in time. Pure, so the timeline is easy to test.
 * Progress never decreases and stays below 100 until the job completes.
 */
export function computeJobState(
  elapsedMs: number,
  totalMs: number,
  scenario: MockScenario,
): JobSnapshot {
  const fraction = totalMs > 0 ? Math.max(0, elapsedMs) / totalMs : 1
  const failure = MOCK_FAILURES[scenario]
  if (failure && fraction >= failure.at) {
    return {
      status: 'failed',
      step: failure.step,
      progress: progressAt(failure.at - 1e-6).progress,
      error: failure.error,
    }
  }
  if (fraction >= 1) return { status: 'completed', step: 'map', progress: 100 }
  return { status: 'running', ...progressAt(fraction) }
}
