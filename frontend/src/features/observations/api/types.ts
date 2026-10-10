import type { ParseIssue } from '../schemas'
import type {
  AnalystReviewRecord,
  AnalystReviewState,
  GeoBounds,
  MonitoringArea,
  MonitoringAreaDetail,
  Observation,
  ObservationSource,
  ObservationSummary,
  ReviewSummary,
  TemporalComparisonResult,
} from '../types'


/** Data that passed validation, plus anything that had to be dropped along the way. */
export interface Validated<T> {
  data: T
  /** Non-empty when some of the response was malformed; the UI shows a "partial data" notice. */
  issues: ParseIssue[]
}

export interface CreateObservationInput {
  file: File
  source: ObservationSource
  /** Shown name. Empty: the service names the result after the image's location. */
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

  // Phase 3 — Analyst Features
  getReviews(observationId?: string, options?: RequestOptions): Promise<Validated<AnalystReviewRecord[]>>
  getReviewSummary(options?: RequestOptions): Promise<ReviewSummary>
  saveReview(
    review: { observationId: string; detectionId?: string; status: AnalystReviewState; notes?: string; reviewerId?: string },
    options?: RequestOptions,
  ): Promise<AnalystReviewRecord>

  listMonitoringAreas(options?: RequestOptions): Promise<Validated<MonitoringArea[]>>
  getMonitoringArea(id: string, options?: RequestOptions): Promise<Validated<MonitoringAreaDetail>>
  createMonitoringArea(
    area: { name: string; description?: string; geometry: any; crs?: string; purpose?: string },
    options?: RequestOptions,
  ): Promise<MonitoringArea>
  updateMonitoringArea(
    id: string,
    area: Partial<{ name: string; description?: string; geometry: any; purpose?: string; status: 'active' | 'archived' }>,
    options?: RequestOptions,
  ): Promise<MonitoringArea>
  deleteMonitoringArea(id: string, options?: RequestOptions): Promise<{ ok: boolean }>

  compareObservations(
    input: { baselineObservationId: string; comparisonObservationId: string; matchingIoUThreshold?: number },
    options?: RequestOptions,
  ): Promise<TemporalComparisonResult>
  getQualityOverlays(id: string, options?: RequestOptions): Promise<Record<string, unknown>>
}


export function isTerminalJob(job: Pick<Job, 'status'>): boolean {
  return job.status === 'completed' || job.status === 'failed'
}
