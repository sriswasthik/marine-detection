import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  ApiError,
  networkError,
  offlineError,
  timeoutError,
} from '@/features/observations/api/errors'
import { codeForStatus, createAppError, isAppError, isAutoRetryable, toAppError } from './appError'
import { APP_ERROR_CODES, ERROR_COPY } from './errorCopy'

const online = { online: true }

describe('error copy', () => {
  it('has a title and a message with a next step for every code', () => {
    for (const code of APP_ERROR_CODES) {
      const copy = ERROR_COPY[code]
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.message).toMatch(/\.$/)
      // Plain words only: no generic dead end, no exclamation marks.
      expect(copy.title).not.toMatch(/something went wrong/i)
      expect(`${copy.title} ${copy.message}`).not.toContain('!')
    }
  })
})

describe('toAppError', () => {
  it('passes AppErrors through and attaches a retry only when recoverable', () => {
    const retry = vi.fn()
    const network = toAppError(createAppError('NETWORK'), { retry })
    expect(network.code).toBe('NETWORK')
    network.retry?.()
    expect(retry).toHaveBeenCalledOnce()
    expect(toAppError(createAppError('NOT_FOUND'), { retry }).retry).toBeUndefined()
  })

  it('maps zod errors to INVALID_RESPONSE with the first field as reference', () => {
    const result = z.object({ confidence: z.number() }).safeParse({ confidence: 'high' })
    if (result.success) throw new Error('expected a parse failure')
    const error = toAppError(result.error, online)
    expect(error).toMatchObject({
      code: 'INVALID_RESPONSE',
      reference: 'Invalid field: confidence',
    })
    expect(error.message).not.toContain('Expected number')
  })

  it("maps the app's own parse issues to INVALID_RESPONSE", () => {
    expect(
      toAppError([{ path: 'detections.3.confidence', message: 'Too big' }], online),
    ).toMatchObject({
      code: 'INVALID_RESPONSE',
      reference: 'Invalid field: detections.3.confidence',
    })
  })

  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'ACCESS_DENIED'],
    [403, 'ACCESS_DENIED'],
    [404, 'NOT_FOUND'],
    [408, 'TIMEOUT'],
    [413, 'FILE_TOO_LARGE'],
    [415, 'UNSUPPORTED_FILE'],
    [422, 'INVALID_IMAGE'],
    [429, 'RATE_LIMITED'],
    [418, 'BAD_REQUEST'],
    [500, 'SERVER'],
    [501, 'NOT_IMPLEMENTED'],
    [502, 'SERVICE_UNAVAILABLE'],
    [503, 'SERVICE_UNAVAILABLE'],
    [504, 'TIMEOUT'],
    [599, 'SERVER'],
  ] as const)('maps HTTP %i to %s', (status, code) => {
    expect(codeForStatus(status)).toBe(code)
    expect(toAppError(status, online)).toMatchObject({ code, reference: `HTTP ${status}` })
    // Anything with a numeric status, such as a fetch Response.
    expect(toAppError({ status, statusText: 'x' }, online).code).toBe(code)
  })

  it('maps aborts and timeouts', () => {
    expect(toAppError(new DOMException('stop', 'AbortError'), online).code).toBe('ABORTED')
    expect(toAppError(new DOMException('slow', 'TimeoutError'), online).code).toBe('TIMEOUT')
    expect(toAppError(timeoutError(20_000), online).code).toBe('TIMEOUT')
  })

  it('maps network failures, and reports them as offline when the device is offline', () => {
    expect(toAppError(networkError(), online).code).toBe('NETWORK')
    expect(toAppError(new TypeError('Failed to fetch'), online).code).toBe('NETWORK')
    expect(toAppError(new TypeError('NetworkError when attempting to fetch'), online).code).toBe(
      'NETWORK',
    )
    expect(toAppError(networkError(), { online: false }).code).toBe('OFFLINE')
    expect(toAppError(offlineError(), online)).toMatchObject({ code: 'OFFLINE', recoverable: true })
  })

  it('maps ApiErrors by code first, then by status', () => {
    expect(toAppError(new ApiError('x', { status: 404, code: 'NOT_FOUND' }), online).code).toBe(
      'NOT_FOUND',
    )
    expect(
      toAppError(new ApiError('x', { status: 502, code: 'INVALID_RESPONSE' }), online).code,
    ).toBe('INVALID_RESPONSE')
    expect(
      toAppError(new ApiError('x', { status: 503, code: 'SERVER_ERROR' }), online),
    ).toMatchObject({ code: 'SERVICE_UNAVAILABLE', reference: 'HTTP 503' })
    expect(
      toAppError(new ApiError('x', { status: 501, code: 'NOT_IMPLEMENTED' }), online),
    ).toMatchObject({ code: 'NOT_IMPLEMENTED', recoverable: false })
  })

  it('maps job errors by their code', () => {
    const job = (code: string) => ({ code, message: 'From the service.', recoverable: true })
    expect(toAppError(job('MODEL_ERROR'), online).code).toBe('MODEL_FAILED')
    expect(toAppError(job('INVALID_IMAGE'), online).code).toBe('INVALID_IMAGE')
    expect(toAppError(job('GPU_OUT_OF_MEMORY'), online)).toMatchObject({
      code: 'SERVER',
      reference: 'GPU_OUT_OF_MEMORY',
    })
  })

  it('never shows raw messages or stack traces for unexpected errors', () => {
    const thrown = new Error('Cannot read properties of undefined (reading "map")')
    for (const input of [thrown, 'a plain string', null, undefined, 42.5, { weird: true }]) {
      const error = toAppError(input, online)
      expect(error.code).toBe('UNEXPECTED')
      expect(error.message).toBe(ERROR_COPY.UNEXPECTED.message)
      expect(`${error.title} ${error.message}`).not.toMatch(/undefined|reading|at \w/)
    }
  })

  it('always returns a valid AppError', () => {
    for (const input of [new Error('x'), 500, networkError(), [{ path: '', message: 'm' }]]) {
      expect(isAppError(toAppError(input, online))).toBe(true)
    }
  })
})

describe('isAutoRetryable', () => {
  it('retries transient failures only', () => {
    expect(isAutoRetryable(createAppError('NETWORK'))).toBe(true)
    expect(isAutoRetryable(createAppError('SERVICE_UNAVAILABLE'))).toBe(true)
    expect(isAutoRetryable(createAppError('OFFLINE'))).toBe(false)
    expect(isAutoRetryable(createAppError('NOT_FOUND'))).toBe(false)
    expect(isAutoRetryable(createAppError('ABORTED'))).toBe(false)
    expect(isAutoRetryable(createAppError('INVALID_RESPONSE'))).toBe(false)
  })
})
