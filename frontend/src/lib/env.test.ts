import { describe, expect, it } from 'vitest'
import { readEnv } from './env'

describe('readEnv', () => {
  it('defaults to mock mode with standard settings', () => {
    expect(readEnv({})).toEqual({
      useMock: true,
      apiBaseUrl: 'http://localhost:8000',
      appName: 'Marine Waste Intelligence',
      demoFast: false,
    })
  })

  it('parses booleans and trims the base URL', () => {
    const env = readEnv({
      VITE_USE_MOCK: 'false',
      VITE_DEMO_FAST: 'TRUE',
      VITE_API_BASE_URL: 'https://api.example.org/',
      VITE_APP_NAME: '  Custom name ',
    })
    expect(env).toEqual({
      useMock: false,
      apiBaseUrl: 'https://api.example.org',
      appName: 'Custom name',
      demoFast: true,
    })
  })

  it('falls back on unrecognised values', () => {
    expect(readEnv({ VITE_USE_MOCK: 'maybe', VITE_DEMO_FAST: '' }).useMock).toBe(true)
    expect(readEnv({ VITE_USE_MOCK: '0' }).useMock).toBe(false)
  })
})
