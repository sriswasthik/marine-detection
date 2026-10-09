import { createContext, useContext } from 'react'

/** Opens the command palette, for the top bar hint and the More sheet (Ctrl or Cmd + K does too). */
export const CommandPaletteContext = createContext<() => void>(() => {})

export function useOpenCommandPalette(): () => void {
  return useContext(CommandPaletteContext)
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere. */
export function modifierKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl'
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl'
}
