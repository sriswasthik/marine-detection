import { useCallback, useSyncExternalStore } from 'react'

function canMatch(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/** True while the media query matches. False on the server and where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canMatch()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => canMatch() && window.matchMedia(query).matches,
    () => false,
  )
}
