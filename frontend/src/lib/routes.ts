import { matchPath } from 'react-router-dom'

/** Observation id in the current URL, from /map/:id, /observations/:id or its report. */
export function observationIdFromPath(pathname: string): string | null {
  for (const pattern of ['/map/:id', '/observations/:id', '/observations/:id/report']) {
    const match = matchPath(pattern, pathname)
    if (match?.params.id) return decodeURIComponent(match.params.id)
  }
  return null
}

/**
 * Where to go when another observation is picked: stay on the same kind of page
 * (map, detail or report) for the new observation, otherwise open it on the map.
 */
export function pathForObservation(currentPathname: string, observationId: string): string {
  const id = encodeURIComponent(observationId)
  if (matchPath('/observations/:id/report', currentPathname)) return `/observations/${id}/report`
  if (matchPath('/observations/:id', currentPathname)) return `/observations/${id}`
  return `/map/${id}`
}
