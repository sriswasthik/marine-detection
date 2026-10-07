import type { ParseIssue } from '../schemas'
import type { GeoBounds, Observation, ObservationSource, ObservationSummary } from '../types'

/** Data that passed validation, plus anything that had to be dropped along the way. */
export interface Validated<T> {
  data: T
  /** Non-empty when some of the response was malformed; the UI shows a "partial data" notice. */
  issues: ParseIssue[]
}

export interface CreateObservationInput {
  file: File
  source: ObservationSource
  region: string
  /** ISO 8601 timestamp of image capture. */
  capturedAt: string
  /** Optional footprint when the file carries no georeferencing. */
  bounds?: GeoBounds
}

export interface RequestOptions {
  signal?: AbortSignal
}

export interface UploadOptions extends RequestOptions {
  /** Upload progress, 0 to 100. */
  onUploadProgress?: (percent: number) => void
}

export const JOB_STEPS = ['upload', 'preprocess', 'detect', 'map'] as const
export type JobStep = (typeof JOB_STEPS)[number]

export const JOB_STATUSES = ['queued', 'running', 'completed', 'failed'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export interface JobError {
  code: string
  /** Plain-language message: what went wrong and what to do next. */
  message: string
  /** True when trying again (or fixing the input) can succeed. */
  recoverable: boolean
}

export interface Job {
  jobId: string
  status: JobStatus
  step: JobStep
  /** Overall progress, 0 to 100. */
  progress: number
  /** Set once the job has completed. */
  observationId?: string
  error?: JobError
}

export interface HealthStatus {
  ok: boolean
  mode: 'mock' | 'http'
  modelName: string
  modelVersion: string
}

/** Every server call goes through this interface. See ./index.ts for the factory. */
export interface ObservationsApi {
  listObservations(options?: RequestOptions): Promise<Validated<ObservationSummary[]>>
  getObservation(id: string, options?: RequestOptions): Promise<Validated<Observation>>
  createObservation(
    input: CreateObservationInput,
    options?: UploadOptions,
  ): Promise<{ jobId: string }>
  getJob(jobId: string, options?: RequestOptions): Promise<Job>
  health(options?: RequestOptions): Promise<HealthStatus>
}

export function isTerminalJob(job: Pick<Job, 'status'>): boolean {
  return job.status === 'completed' || job.status === 'failed'
}
