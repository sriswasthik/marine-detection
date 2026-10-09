import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useObservationsApi } from '@/features/observations/api/apiContext'
import type { CreateObservationInput, JobStep } from '@/features/observations/api/types'
import { JOB_POLL_INTERVAL_MS, observationKeys } from '@/features/observations/hooks'
import { analyzeObservation } from '@/lib/analysis'
import { observationNotices } from '@/lib/warnings'
import {
  failureFromError,
  failureFromJob,
  IDLE_RUN,
  runReducer,
  type RunSummary,
} from './runReducer'

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Cancelled', 'AbortError'))
      },
      { once: true },
    )
  })
}

/**
 * Runs one analysis: upload with progress, then poll the job until it completes or fails.
 * Cancel aborts the upload or stops polling. Retrying is just another run with the same input.
 */
export function useAnalysisRun() {
  const api = useObservationsApi()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(runReducer, IDLE_RUN)
  const controller = useRef<AbortController | null>(null)
  /** True from the moment a run starts until it ends: a second click must not upload twice. */
  const inFlight = useRef(false)

  useEffect(() => () => controller.current?.abort(), [])

  const start = useCallback(
    async (input: CreateObservationInput) => {
      if (inFlight.current) return
      inFlight.current = true
      controller.current?.abort()
      const run = new AbortController()
      controller.current = run
      const { signal } = run
      dispatch({ type: 'start', at: Date.now() })
      let step: JobStep = 'upload'

      try {
        const { jobId } = await api.createObservation(input, {
          signal,
          onUploadProgress: (percent) => dispatch({ type: 'uploadProgress', percent }),
        })
        dispatch({ type: 'uploaded', jobId })

        for (;;) {
          const job = await api.getJob(jobId, { signal })
          if (signal.aborted) return
          step = job.step
          dispatch({ type: 'jobUpdate', job })

          if (job.status === 'failed') {
            dispatch({
              type: 'failed',
              failure: failureFromJob(job),
              at: Date.now(),
              step: job.step,
            })
            return
          }
          if (job.status === 'completed' && job.observationId) {
            const observationId = job.observationId
            let summary: RunSummary | null = null
            try {
              const result = await queryClient.fetchQuery({
                queryKey: observationKeys.detail(observationId),
                queryFn: ({ signal: querySignal }) =>
                  api.getObservation(observationId, { signal: querySignal }),
              })
              summary = {
                detectionCount: result.data.detections.length,
                hotspotCount: analyzeObservation(result.data).hotspots.length,
                notices: observationNotices(result.data, {
                  partialData: result.issues.length > 0,
                  only: ['low-confidence', 'approximate-positions', 'partial-data'],
                }),
              }
            } catch {
              // The result exists even if the summary cannot be fetched; the map will load it.
            }
            if (signal.aborted) return
            void queryClient.invalidateQueries({ queryKey: observationKeys.list() })
            dispatch({ type: 'succeeded', observationId, summary, at: Date.now() })
            return
          }
          await wait(JOB_POLL_INTERVAL_MS, signal)
        }
      } catch (error) {
        const failure = failureFromError(error)
        if (failure && !signal.aborted) dispatch({ type: 'failed', failure, at: Date.now(), step })
      } finally {
        if (controller.current === run) inFlight.current = false
      }
    },
    [api, queryClient],
  )

  const cancel = useCallback(() => {
    inFlight.current = false
    controller.current?.abort()
    dispatch({ type: 'cancel' })
  }, [])

  const reset = useCallback(() => {
    controller.current?.abort()
    dispatch({ type: 'reset' })
  }, [])

  return { state, start, cancel, reset }
}
