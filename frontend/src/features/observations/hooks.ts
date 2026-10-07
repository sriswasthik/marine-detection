import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useObservationsApi } from './api/apiContext'
import { isTerminalJob, type CreateObservationInput, type UploadOptions } from './api/types'

export const observationKeys = {
  all: ['observations'] as const,
  list: () => [...observationKeys.all, 'list'] as const,
  detail: (id: string) => [...observationKeys.all, 'detail', id] as const,
}

export const jobKeys = {
  all: ['jobs'] as const,
  detail: (jobId: string) => [...jobKeys.all, jobId] as const,
}

export const healthKeys = {
  all: ['health'] as const,
}

export const JOB_POLL_INTERVAL_MS = 600

export function useObservations() {
  const api = useObservationsApi()
  return useQuery({
    queryKey: observationKeys.list(),
    queryFn: ({ signal }) => api.listObservations({ signal }),
  })
}

export function useObservation(id: string | null | undefined) {
  const api = useObservationsApi()
  return useQuery({
    queryKey: observationKeys.detail(id ?? ''),
    queryFn: ({ signal }) => api.getObservation(id ?? '', { signal }),
    enabled: Boolean(id),
  })
}

/** Whether the processing service answers, and which model it runs. */
export function useHealth() {
  const api = useObservationsApi()
  return useQuery({
    queryKey: healthKeys.all,
    queryFn: ({ signal }) => api.health({ signal }),
    staleTime: 60_000,
  })
}

export interface CreateObservationVariables extends UploadOptions {
  input: CreateObservationInput
}

/** Uploads an image and starts an analysis job. Not retried: uploads are not idempotent. */
export function useCreateObservation() {
  const api = useObservationsApi()
  return useMutation({
    mutationFn: ({ input, ...options }: CreateObservationVariables) =>
      api.createObservation(input, options),
    retry: false,
  })
}

/**
 * Polls a job every JOB_POLL_INTERVAL_MS until it completes or fails.
 * On completion the observation list is refreshed so the new observation appears.
 */
export function useJob(jobId: string | null | undefined) {
  const api = useObservationsApi()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: jobKeys.detail(jobId ?? ''),
    queryFn: ({ signal }) => api.getJob(jobId ?? '', { signal }),
    enabled: Boolean(jobId),
    staleTime: 0,
    refetchInterval: (q) =>
      q.state.data && isTerminalJob(q.state.data) ? false : JOB_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  })

  const completedObservationId =
    query.data?.status === 'completed' ? query.data.observationId : undefined
  useEffect(() => {
    if (completedObservationId) {
      void queryClient.invalidateQueries({ queryKey: observationKeys.list() })
    }
  }, [completedObservationId, queryClient])

  return query
}
