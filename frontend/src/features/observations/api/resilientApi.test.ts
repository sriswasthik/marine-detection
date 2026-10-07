import { afterEach, describe, expect, it, vi } from 'vitest'
import { toAppError } from '@/lib/errors/appError'
import { createMockApi } from './mockApi'
import { withResilience } from './resilientApi'
import type { ObservationsApi } from './types'

const fast = () =>
  createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0], scenario: () => 'success' })

/** An API whose list call never settles unless aborted, like a stalled connection. */
function stalled(): ObservationsApi & { lastSignal: () => AbortSignal | undefined } {
  let signal: AbortSignal | undefined
  return {
    ...fast(),
    listObservations: (options = {}) => {
      signal = options.signal
      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })
    },
    lastSignal: () => signal,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('withResilience', () => {
  it('passes results through when online', async () => {
    const api = withResilience(fast(), { isOnline: () => true })
    const result = await api.listObservations()
    expect(result.data.length).toBeGreaterThan(0)
  })

  it('fails at once with a recoverable OFFLINE error when offline, without calling the service', async () => {
    const base = fast()
    const spy = vi.spyOn(base, 'getObservation')
    const api = withResilience(base, { isOnline: () => false })
    const error: unknown = await api.getObservation('obs-ennore-20261003').catch((e: unknown) => e)
    expect(toAppError(error)).toMatchObject({ code: 'OFFLINE', recoverable: true })
    expect(spy).not.toHaveBeenCalled()
  })

  it('times out a stalled request and aborts it', async () => {
    vi.useFakeTimers()
    const base = stalled()
    const api = withResilience(base, { isOnline: () => true, timeoutMs: 1000 })
    const pending = api.listObservations().catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(1000)
    expect(toAppError(await pending)).toMatchObject({ code: 'TIMEOUT', recoverable: true })
    expect(base.lastSignal()?.aborted).toBe(true)
  })

  it('fails a request in flight when the connection drops', async () => {
    const base = stalled()
    const api = withResilience(base, { isOnline: () => true, timeoutMs: 60_000 })
    const pending = api.listObservations().catch((e: unknown) => e)
    window.dispatchEvent(new Event('offline'))
    expect(toAppError(await pending).code).toBe('OFFLINE')
    expect(base.lastSignal()?.aborted).toBe(true)
  })

  it('lets a cancellation by the caller through as a cancellation', async () => {
    const base = stalled()
    const api = withResilience(base, { isOnline: () => true, timeoutMs: 60_000 })
    const controller = new AbortController()
    const pending = api.listObservations({ signal: controller.signal }).catch((e: unknown) => e)
    controller.abort()
    expect(toAppError(await pending).code).toBe('ABORTED')
  })

  it('keeps upload progress working through the wrapper', async () => {
    const api = withResilience(
      createMockApi({ latencyMs: [0, 0], pipelineDurationMs: 200, scenario: () => 'success' }),
      { isOnline: () => true },
    )
    const progress: number[] = []
    await api.createObservation(
      {
        file: new File(['x'], 'ennore.tif'),
        source: 'satellite',
        region: 'Ennore',
        capturedAt: '2026-10-03T05:00:00Z',
      },
      { onUploadProgress: (percent) => progress.push(percent) },
    )
    expect(progress.at(-1)).toBe(100)
  })
})
