import { JOB_STEPS, type Job, type JobStep } from '@/features/observations/api/types'
import { createAppError, toAppError, type AppError } from '@/lib/errors/appError'
import type { AppErrorCode } from '@/lib/errors/errorCopy'
import { formatInteger } from '@/lib/format'
import type { ObservationNotice } from '@/lib/warnings'

export type StepStatus = 'pending' | 'active' | 'done' | 'failed'
export type RunFailureKind = 'invalid' | 'server' | 'network'

export interface RunFailure {
  kind: RunFailureKind
  title: string
  message: string
  code: string | null
}

export interface RunSummary {
  detectionCount: number
  hotspotCount: number
  /** Caveats to read the result with: low confidence, approximate positions. */
  notices: ObservationNotice[]
}

export type RunState =
  | { phase: 'idle' }
  | {
      phase: 'running'
      step: JobStep
      /** Upload percentage, 0 to 100, while the file is being sent. */
      uploadPercent: number
      progress: number
      startedAt: number
      jobId: string | null
    }
  | {
      phase: 'succeeded'
      observationId: string
      summary: RunSummary | null
      startedAt: number
      finishedAt: number
    }
  | { phase: 'failed'; step: JobStep; failure: RunFailure; startedAt: number; finishedAt: number }

export type RunAction =
  | { type: 'start'; at: number }
  | { type: 'uploadProgress'; percent: number }
  | { type: 'uploaded'; jobId: string }
  | { type: 'jobUpdate'; job: Job }
  | { type: 'succeeded'; observationId: string; summary: RunSummary | null; at: number }
  | { type: 'failed'; failure: RunFailure; at: number; step?: JobStep }
  | { type: 'cancel' }
  | { type: 'reset' }

export const IDLE_RUN: RunState = { phase: 'idle' }

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

/**
 * The processing run as a state machine. Actions that do not fit the current phase (a late
 * job update after a cancel, for example) are ignored rather than corrupting the state.
 */
export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'start':
      return {
        phase: 'running',
        step: 'upload',
        uploadPercent: 0,
        progress: 0,
        startedAt: action.at,
        jobId: null,
      }
    case 'uploadProgress':
      if (state.phase !== 'running' || state.step !== 'upload') return state
      return {
        ...state,
        uploadPercent: Math.max(state.uploadPercent, clampPercent(action.percent)),
      }
    case 'uploaded':
      if (state.phase !== 'running') return state
      return { ...state, jobId: action.jobId, uploadPercent: 100 }
    case 'jobUpdate': {
      if (state.phase !== 'running') return state
      const current = JOB_STEPS.indexOf(state.step)
      const next = JOB_STEPS.indexOf(action.job.step)
      // Steps only move forward.
      return {
        ...state,
        step: next >= current ? action.job.step : state.step,
        progress: Math.max(state.progress, clampPercent(action.job.progress)),
      }
    }
    case 'succeeded':
      if (state.phase !== 'running') return state
      return {
        phase: 'succeeded',
        observationId: action.observationId,
        summary: action.summary,
        startedAt: state.startedAt,
        finishedAt: action.at,
      }
    case 'failed':
      if (state.phase !== 'running') return state
      return {
        phase: 'failed',
        step: action.step ?? state.step,
        failure: action.failure,
        startedAt: state.startedAt,
        finishedAt: action.at,
      }
    case 'cancel':
      return state.phase === 'running' ? IDLE_RUN : state
    case 'reset':
      return IDLE_RUN
  }
}

/** Status of each of the four steps, for the stepper. */
export function stepStatuses(state: RunState): Record<JobStep, StepStatus> {
  const statuses = Object.fromEntries(JOB_STEPS.map((s) => [s, 'pending'])) as Record<
    JobStep,
    StepStatus
  >
  if (state.phase === 'succeeded') {
    for (const step of JOB_STEPS) statuses[step] = 'done'
    return statuses
  }
  if (state.phase !== 'running' && state.phase !== 'failed') return statuses
  const current = JOB_STEPS.indexOf(state.step)
  JOB_STEPS.forEach((step, index) => {
    if (index < current) statuses[step] = 'done'
    else if (index === current) statuses[step] = state.phase === 'failed' ? 'failed' : 'active'
  })
  return statuses
}

// ---------------------------------------------------------------------------
// Failure wording: every failure goes through toAppError, so the copy lives in errorCopy.ts.
// ---------------------------------------------------------------------------

const NETWORK_CODES: ReadonlySet<AppErrorCode> = new Set(['OFFLINE', 'NETWORK', 'TIMEOUT'])
const INVALID_CODES: ReadonlySet<AppErrorCode> = new Set([
  'INVALID_IMAGE',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_FILE',
  'BAD_REQUEST',
])

/**
 * How the Analyze page treats a failure: `invalid` sends the user back to pick another file,
 * `network` and `server` offer Retry with the same file and details.
 */
export function failureFromAppError(error: AppError): RunFailure {
  const kind: RunFailureKind = NETWORK_CODES.has(error.code)
    ? 'network'
    : INVALID_CODES.has(error.code)
      ? 'invalid'
      : 'server'
  return { kind, title: error.title, message: error.message, code: error.code }
}

/** A failed job, as reported by the backend. An upload that fails means the file was unusable. */
export function failureFromJob(job: Job): RunFailure {
  if (!job.error) {
    return failureFromAppError(createAppError(job.step === 'upload' ? 'INVALID_IMAGE' : 'SERVER'))
  }
  const error = toAppError(job.error)
  if (job.step === 'upload' && error.code === 'SERVER') {
    return failureFromAppError(createAppError('INVALID_IMAGE'))
  }
  // "The detection step failed" only when it was the detection step.
  if (error.code === 'MODEL_FAILED' && job.step !== 'detect') {
    return failureFromAppError(createAppError('SERVER'))
  }
  return failureFromAppError(error)
}

/** A request that rejected, from createObservation or getJob. Null for a cancelled request. */
export function failureFromError(error: unknown): RunFailure | null {
  const normalised = toAppError(error)
  if (normalised.code === 'ABORTED') return null
  return failureFromAppError(normalised)
}

/** "61 regions detected, 3 hotspots", or the designed no-debris wording. */
export function summaryText(summary: RunSummary | null): string {
  if (!summary) return 'Detection finished.'
  if (summary.detectionCount === 0) return 'No debris detected. The whole image was checked.'
  const regions = `${formatInteger(summary.detectionCount)} ${summary.detectionCount === 1 ? 'region' : 'regions'} detected`
  const hotspots = `${formatInteger(summary.hotspotCount)} ${summary.hotspotCount === 1 ? 'hotspot' : 'hotspots'}`
  return `${regions}, ${hotspots}`
}
