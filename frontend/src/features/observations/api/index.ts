import { ENV, type AppEnv } from '@/lib/env'
import { createHttpApi } from './httpApi'
import { createMockApi } from './mockApi'
import type { ObservationsApi } from './types'

export * from './errors'
export * from './types'
export { createHttpApi } from './httpApi'
export { createMockApi, type MockApiOptions } from './mockApi'

/** Picks the mock or HTTP implementation from VITE_USE_MOCK. */
export function createObservationsApi(
  env: Pick<AppEnv, 'useMock' | 'apiBaseUrl'> = ENV,
): ObservationsApi {
  return env.useMock ? createMockApi() : createHttpApi(env.apiBaseUrl)
}

let defaultApi: ObservationsApi | null = null

/** App-wide instance, created on first use so the mock's state lives for the whole session. */
export function getDefaultObservationsApi(): ObservationsApi {
  defaultApi ??= createObservationsApi()
  return defaultApi
}

export const isMockMode = (): boolean => ENV.useMock
