import { useSyncExternalStore } from 'react'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  setPreferences,
  subscribePreferences,
  type Preferences,
} from './preferences'

/** Display preferences and a setter that merges a partial update. Shared by every screen. */
export function usePreferences(): readonly [Preferences, (patch: Partial<Preferences>) => void] {
  const preferences = useSyncExternalStore(
    subscribePreferences,
    getPreferences,
    () => DEFAULT_PREFERENCES,
  )
  return [preferences, setPreferences] as const
}
