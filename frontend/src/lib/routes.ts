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
 * Where to go when another observation is picked on an observation page: the same kind of page
 * (map, detail or report) for the new one. Null on other pages, which stay where they are and
 * simply show the new selection (the overview, for example).
 */
export function pathForObservation(currentPathname: string, observationId: string): string | null {
  const id = encodeURIComponent(observationId)
  if (matchPath('/observations/:id/report', currentPathname)) return `/observations/${id}/report`
  if (matchPath('/observations/:id', currentPathname)) return `/observations/${id}`
  if (matchPath('/map/:id?', currentPathname)) return `/map/${id}`
  return null
}
