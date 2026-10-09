import { describe, expect, it } from 'vitest'
import { breadcrumbsFor, nextStepFor, type PageId } from './navigation'

describe('breadcrumbsFor', () => {
  it('names the observation by its region on the detail page, the last crumb current', () => {
    expect(breadcrumbsFor('/observations/obs-ennore-20261003', 'Ennore coast')).toEqual([
      { label: 'Observations', to: '/observations' },
      { label: 'Ennore coast', to: null },
    ])
  })

  it('links back to the observation from its report', () => {
    expect(breadcrumbsFor('/observations/obs-ennore-20261003/report', 'Ennore coast')).toEqual([
      { label: 'Observations', to: '/observations' },
      { label: 'Ennore coast', to: '/observations/obs-ennore-20261003' },
      { label: 'Report', to: null },
    ])
  })

  it('reads "Observation" until the region is known, and keeps ids encoded', () => {
    const crumbs = breadcrumbsFor('/observations/a%20b/report', null)
    expect(crumbs?.[1]).toEqual({ label: 'Observation', to: '/observations/a%20b' })
  })

  it.each(['/', '/analyze', '/map', '/map/obs-1', '/observations', '/settings'])(
    'has no breadcrumbs on the top-level page %s',
    (path) => {
      expect(breadcrumbsFor(path, 'Ennore coast')).toBeNull()
    },
  )
})

describe('nextStepFor', () => {
  const id = 'obs-ennore-20261003'

  it('follows the main path: overview, map, evidence, report', () => {
    expect(nextStepFor('overview', id)).toEqual({
      label: 'Next: open the map',
      to: `/map/${id}`,
    })
    expect(nextStepFor('analyze', id).to).toBe(`/map/${id}`)
    expect(nextStepFor('map', id)).toEqual({
      label: 'Next: view evidence',
      to: `/observations/${id}`,
    })
    expect(nextStepFor('detail', id)).toEqual({
      label: 'Next: export the report',
      to: `/observations/${id}/report`,
    })
    expect(nextStepFor('report', id).to).toBe('/observations')
  })

  it('has somewhere to go without an observation', () => {
    expect(nextStepFor('overview', null)).toEqual({
      label: 'Next: analyze new imagery',
      to: '/analyze',
    })
    expect(nextStepFor('map', null).to).toBe('/observations')
    expect(nextStepFor('settings', null).to).toBe('/')
  })

  it('always gives a "Next:" label and an app path', () => {
    const pages: PageId[] = [
      'overview',
      'analyze',
      'map',
      'observations',
      'detail',
      'report',
      'settings',
    ]
    for (const page of pages) {
      for (const observationId of [id, null]) {
        const step = nextStepFor(page, observationId)
        expect(step.label).toMatch(/^Next: [a-z]/)
        expect(step.to.startsWith('/')).toBe(true)
      }
    }
  })

  it('encodes the observation id in the path', () => {
    expect(nextStepFor('detail', 'a b').to).toBe('/observations/a%20b/report')
  })
})
