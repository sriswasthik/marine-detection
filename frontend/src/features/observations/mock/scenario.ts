/** Mock scenario switch. Documented in ./index.ts. */

export const MOCK_SCENARIOS = [
  'success',
  'nodebris',
  'lowconf',
  'partial',
  'invalid',
  'modelfail',
  'network',
] as const
export type MockScenario = (typeof MOCK_SCENARIOS)[number]

export const DEFAULT_MOCK_SCENARIO: MockScenario = 'success'

export function isMockScenario(value: unknown): value is MockScenario {
  return typeof value === 'string' && (MOCK_SCENARIOS as readonly string[]).includes(value)
}

let override: MockScenario | null = null
const listeners = new Set<() => void>()

function scenarioFromUrl(): MockScenario | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('mock')
  return isMockScenario(value) ? value : null
}

/** Active scenario: the value set in code, else `?mock=` in the URL, else `success`. */
export function getMockScenario(): MockScenario {
  return override ?? scenarioFromUrl() ?? DEFAULT_MOCK_SCENARIO
}

/** Sets the scenario from code. Pass null to fall back to the URL or the default. */
export function setMockScenario(scenario: MockScenario | null): void {
  override = scenario
  listeners.forEach((listener) => listener())
}

/** Notifies on setMockScenario and on browser history changes that may change `?mock=`. */
export function subscribeMockScenario(listener: () => void): () => void {
  listeners.add(listener)
  if (typeof window !== 'undefined') window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('popstate', listener)
  }
}
