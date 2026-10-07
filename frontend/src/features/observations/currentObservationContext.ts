import { createContext, useContext, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { observationIdFromPath } from '@/lib/routes'

export interface CurrentObservationState {
  /** The observation picked in the top bar, remembered for this browser session. */
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}

export const CurrentObservationContext = createContext<CurrentObservationState>({
  selectedId: null,
  setSelectedId: () => {},
})

export function useCurrentObservationSelection(): CurrentObservationState {
  return useContext(CurrentObservationContext)
}

/**
 * The observation in view: the one in the URL path, else the one picked in the top bar,
 * else the most recent. Null while the list is unknown or empty.
 */
export function useCurrentObservationId(
  observations: readonly { id: string }[] | undefined,
): string | null {
  const location = useLocation()
  const { selectedId } = useCurrentObservationSelection()
  const routeId = observationIdFromPath(location.pathname)
  if (routeId) return routeId
  if (selectedId && observations?.some((o) => o.id === selectedId)) return selectedId
  return observations?.[0]?.id ?? null
}

/** Opening an observation page makes that observation the current selection. */
export function useRememberRouteObservation(): void {
  const location = useLocation()
  const { setSelectedId } = useCurrentObservationSelection()
  const routeId = observationIdFromPath(location.pathname)
  useEffect(() => {
    if (routeId) setSelectedId(routeId)
  }, [routeId, setSelectedId])
}
