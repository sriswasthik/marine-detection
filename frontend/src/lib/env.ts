export interface AppEnv {
  /** Use the in-browser mock backend. Defaults to true so the demo works without a server. */
  useMock: boolean
  apiBaseUrl: string
  appName: string
  /** Shortens the simulated pipeline from about 8 seconds to about 2. */
  demoFast: boolean
}

type RawEnv = Partial<Record<string, string | boolean | undefined>>

function parseBoolean(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return fallback
}

function parseString(value: string | boolean | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

export function readEnv(raw: RawEnv): AppEnv {
  return {
    useMock: parseBoolean(raw.VITE_USE_MOCK, true),
    apiBaseUrl: parseString(raw.VITE_API_BASE_URL, 'http://localhost:8000').replace(/\/+$/, ''),
    appName: parseString(raw.VITE_APP_NAME, 'Marine Waste Intelligence'),
    demoFast: parseBoolean(raw.VITE_DEMO_FAST, false),
  }
}

export const ENV: AppEnv = readEnv(import.meta.env)
