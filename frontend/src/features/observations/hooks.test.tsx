import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from './api/mockApi'
import type { Job, ObservationsApi } from './api/types'
import {
  observationKeys,
  useCreateObservation,
  useJob,
  useObservation,
  useObservations,
} from './hooks'
import { SAMPLE_IDS } from './mock/samples'

function wrapperFor(
  api: ObservationsApi,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <AppProviders api={api} queryClient={queryClient}>
        {children}
      </AppProviders>
    ),
  }
}

const fastMock = () =>
  createMockApi({
    latencyMs: [0, 0],
    pollLatencyMs: [0, 0],
    pipelineDurationMs: 200,
    scenario: () => 'success',
  })

describe('observation hooks', () => {
  it('loads the observation list through the injected api', async () => {
    const { wrapper } = wrapperFor(fastMock())
    const { result } = renderHook(() => useObservations(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data).toHaveLength(6)
  })

  it('loads one observation and stays idle without an id', async () => {
    const { wrapper } = wrapperFor(fastMock())
    const { result } = renderHook(() => useObservation(SAMPLE_IDS.mannar), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data.detections).toEqual([])

    const idle = renderHook(() => useObservation(undefined), { wrapper })
    expect(idle.result.current.fetchStatus).toBe('idle')
  })

  it('creates an observation and polls the job until it completes', async () => {
    const api = fastMock()
    const { wrapper, queryClient } = wrapperFor(api)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    const create = renderHook(() => useCreateObservation(), { wrapper })
    let jobId = ''
    await act(async () => {
      const result = await create.result.current.mutateAsync({
        input: {
          file: new File(['x'], 'scene.tif'),
          source: 'satellite',
          region: 'Test region',
          capturedAt: '2026-10-01T00:00:00Z',
        },
      })
      jobId = result.jobId
    })

    const job = renderHook(() => useJob(jobId), { wrapper })
    await waitFor(() => expect(job.result.current.data?.status).toBe('completed'), {
      timeout: 4000,
    })
    expect(job.result.current.data?.observationId).toMatch(/^obs-upload-/)
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: observationKeys.list() }),
    )
  })

  it('stops polling once a job reaches a terminal state', async () => {
    const responses: Job[] = [
      { jobId: 'job-1', status: 'running', step: 'detect', progress: 50 },
      {
        jobId: 'job-1',
        status: 'failed',
        step: 'detect',
        progress: 60,
        error: { code: 'MODEL_ERROR', message: 'Stopped.', recoverable: true },
      },
    ]
    const getJob = vi.fn(() =>
      Promise.resolve(responses[Math.min(getJob.mock.calls.length - 1, 1)] as Job),
    )
    const api: ObservationsApi = { ...fastMock(), getJob }
    const { wrapper } = wrapperFor(api)
    const { result } = renderHook(() => useJob('job-1'), { wrapper })
    await waitFor(() => expect(result.current.data?.status).toBe('failed'), { timeout: 3000 })
    const callsAtFailure = getJob.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(getJob.mock.calls.length).toBe(callsAtFailure)
  })
})
