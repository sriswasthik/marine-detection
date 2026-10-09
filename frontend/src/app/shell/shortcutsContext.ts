import { createContext, useContext } from 'react'

/** Opens the keyboard shortcuts dialog, for buttons that point to it (the "?" key does too). */
export const ShortcutsDialogContext = createContext<() => void>(() => {})

export function useOpenShortcuts(): () => void {
  return useContext(ShortcutsDialogContext)
}
