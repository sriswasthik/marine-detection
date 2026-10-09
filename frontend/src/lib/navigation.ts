import { matchPath } from 'react-router-dom'

/**
 * Where am I and what next: breadcrumbs for deep pages and the "Next" step at the end of each
 * page, along the main path Overview, Analyze, Map, Observation detail, Report.
 */

export interface Crumb {
  label: string
  /** Null for the current page. */
  to: string | null
}

const observationPath = (id: string) => `/observations/${encodeURIComponent(id)}`

/**
 * Breadcrumbs for the deep pages (observation detail and report), or null elsewhere. The
 * observation is named by its region once it has loaded.
 */
export function breadcrumbsFor(pathname: string, region: string | null): Crumb[] | null {
  const report = matchPath('/observations/:id/report', pathname)
  const detail = matchPath('/observations/:id', pathname)
  const id = report?.params.id ?? detail?.params.id
  if (!id) return null
  const name = region ?? 'Observation'
  const observations: Crumb = { label: 'Observations', to: '/observations' }
  if (report) {
    return [
      observations,
      { label: name, to: observationPath(decodeURIComponent(id)) },
      { label: 'Report', to: null },
    ]
  }
  return [observations, { label: name, to: null }]
}

export type PageId =
  'overview' | 'analyze' | 'map' | 'observations' | 'detail' | 'report' | 'settings'

export interface NextStep {
  label: string
  to: string
}

/** The logical next screen from a page, for the observation in view when it matters. */
export function nextStepFor(page: PageId, observationId: string | null): NextStep {
  const map: NextStep | null = observationId
    ? { label: 'Next: open the map', to: `/map/${encodeURIComponent(observationId)}` }
    : null
  switch (page) {
    case 'overview':
      return map ?? { label: 'Next: analyze new imagery', to: '/analyze' }
    case 'analyze':
      return map ?? { label: 'Next: open the map', to: '/map' }
    case 'map':
      return observationId
        ? { label: 'Next: view evidence', to: observationPath(observationId) }
        : { label: 'Next: browse observations', to: '/observations' }
    case 'observations':
      return map ?? { label: 'Next: analyze new imagery', to: '/analyze' }
    case 'detail':
      return observationId
        ? { label: 'Next: export the report', to: `${observationPath(observationId)}/report` }
        : { label: 'Next: browse observations', to: '/observations' }
    case 'report':
      return { label: 'Next: back to all observations', to: '/observations' }
    case 'settings':
      return { label: 'Next: back to the overview', to: '/' }
  }
}
