import { describe, expect, it } from 'vitest'
import { createQueryClient } from '@/app/queryClient'
import { ApiError, isClientError, networkError, shouldRetryRequest } from './errors'
import { createHttpApi } from './httpApi'
import { createObservationsApi } from './index'

const notFound = new ApiError('Not found', { status: 404, code: 'NOT_FOUND' })
const serverError = new ApiError('Boom', { status: 503, code: 'SERVER_ERROR' })
const notImplemented = new ApiError('Later', { status: 501, code: 'NOT_IMPLEMENTED' })

describe('retry rules', () => {
  it('never retries 4xx responses', () => {
    expect(isClientError(notFound)).toBe(true)
    expect(shouldRetryRequest(0, notFound)).toBe(false)
    expect(
      shouldRetryRequest(0, new ApiError('Too big', { status: 413, code: 'FILE_TOO_LARGE' })),
    ).toBe(false)
  })

  it('retries network and 5xx errors twice', () => {
    for (const error of [networkError(), serverError, new Error('unexpected')]) {
      expect(shouldRetryRequest(0, error)).toBe(true)
      expect(shouldRetryRequest(1, error)).toBe(true)
      expect(shouldRetryRequest(2, error)).toBe(false)
    }
  })

  it('does not retry cancelled or not implemented requests', () => {
    expect(shouldRetryRequest(0, new DOMException('stop', 'AbortError'))).toBe(false)
    expect(shouldRetryRequest(0, notImplemented)).toBe(false)
  })

  it('is wired into the query client', () => {
    const client = createQueryClient()
    expect(client.getDefaultOptions().queries?.retry).toBe(shouldRetryRequest)
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })
})

describe('api factory', () => {
  it('chooses the implementation from the environment', async () => {
    const http = createObservationsApi({ useMock: false, apiBaseUrl: 'http://api.test' })
    await expect(http.listObservations()).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
      status: 501,
    })
    const mock = createObservationsApi({ useMock: true, apiBaseUrl: 'http://api.test' })
    expect(mock).not.toHaveProperty('baseUrl')
  })

  it('stubs every HTTP method with a clear message', async () => {
    const api = createHttpApi('http://api.test')
    expect(api.baseUrl).toBe('http://api.test')
    await expect(api.getObservation('x')).rejects.toThrow(/VITE_USE_MOCK=true/)
    await expect(api.getJob('x')).rejects.toBeInstanceOf(ApiError)
    await expect(api.health()).rejects.toBeInstanceOf(ApiError)
  })
})
