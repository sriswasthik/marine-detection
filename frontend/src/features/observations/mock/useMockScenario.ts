import { useSyncExternalStore } from 'react'
import {
  DEFAULT_MOCK_SCENARIO,
  getMockScenario,
  setMockScenario,
  subscribeMockScenario,
  type MockScenario,
} from './scenario'

/** Current mock scenario and a setter. Pass null to the setter to return to the URL or default. */
export function useMockScenario(): readonly [
  MockScenario,
  (scenario: MockScenario | null) => void,
] {
  const scenario = useSyncExternalStore(
    subscribeMockScenario,
    getMockScenario,
    () => DEFAULT_MOCK_SCENARIO,
  )
  return [scenario, setMockScenario] as const
}
