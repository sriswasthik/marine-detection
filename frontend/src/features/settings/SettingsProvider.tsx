import { useState, type ReactNode } from 'react'
import { SettingsContext } from './settingsContext'
import { getAppSettingsStore, type SettingsStore } from './settingsStore'

/**
 * Provides the settings store. The app uses the shared store; tests pass their own (for example
 * one backed by a throwing or corrupt storage).
 */
export function SettingsProvider({
  store,
  children,
}: {
  store?: SettingsStore
  children: ReactNode
}) {
  const [active] = useState(() => store ?? getAppSettingsStore())
  return <SettingsContext value={active}>{children}</SettingsContext>
}
