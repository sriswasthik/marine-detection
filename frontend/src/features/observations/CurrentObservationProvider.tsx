import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CurrentObservationContext } from './currentObservationContext'

const STORAGE_KEY = 'mwi.selectedObservation'

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(STORAGE_KEY, id)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode); the selection then lasts for this page only.
  }
}

/** Remembers which observation is in view across pages, for this browser session. */
export function CurrentObservationProvider({
  children,
  initialId,
}: {
  children: ReactNode
  /** Start with this selection instead of the stored one (tests, deep links). */
  initialId?: string | null
}) {
  const [selectedId, setSelected] = useState<string | null>(() =>
    initialId !== undefined ? initialId : readStored(),
  )
  const setSelectedId = useCallback((id: string | null) => {
    setSelected(id)
    writeStored(id)
  }, [])
  const value = useMemo(() => ({ selectedId, setSelectedId }), [selectedId, setSelectedId])
  return <CurrentObservationContext value={value}>{children}</CurrentObservationContext>
}
