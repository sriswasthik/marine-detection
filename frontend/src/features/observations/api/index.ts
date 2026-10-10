import { getAppSettingsStore } from '@/features/settings/settingsStore'
import { ENV, type AppEnv } from '@/lib/env'
import type { DataSource } from '@/lib/settings'
import { createHttpApi } from './httpApi'
import { createMockApi } from './mockApi'
import { withResilience } from './resilientApi'
import type { ObservationsApi } from './types'

export * from './errors'
export * from './types'
export { createHttpApi } from './httpApi'
export { createMockApi, type MockApiOptions } from './mockApi'
export { withResilience, type ResilienceOptions } from './resilientApi'

/**
 * Picks the mock or HTTP implementation, wrapped so that no call hangs: offline requests fail at
 * once and slow ones time out.
 */
export function createObservationsApi(
  env: Pick<AppEnv, 'useMock' | 'apiBaseUrl'> = ENV,
): ObservationsApi {
  return withResilience(env.useMock ? createMockApi() : createHttpApi(env.apiBaseUrl))
}

let mockApi: ObservationsApi | null = null
const httpApis = new Map<string, ObservationsApi>()

/**
 * The API for a data source. The mock keeps one instance for the whole session, so simulated
 * uploads survive switching to the live service and back.
 */
export function observationsApiFor(dataSource: DataSource, apiBaseUrl: string): ObservationsApi {
  if (dataSource === 'mock') {
    mockApi ??= createObservationsApi({ useMock: true, apiBaseUrl })
    return mockApi
  }
  let api = httpApis.get(apiBaseUrl)
  if (!api) {
    api = createObservationsApi({ useMock: false, apiBaseUrl })
    httpApis.set(apiBaseUrl, api)
  }
  return api
}

/** The app-wide API for the data source chosen in Settings (or the environment default). */
export function getDefaultObservationsApi(): ObservationsApi {
  const { dataSource, apiBaseUrl } = getAppSettingsStore().get()
  return observationsApiFor(dataSource, apiBaseUrl)
}

export { getDefaultObservationsApi as getApi }

/** True while the app runs on sample data. Every screen labels it "Sample data". */
export const isMockMode = (): boolean => getAppSettingsStore().get().dataSource === 'mock'

