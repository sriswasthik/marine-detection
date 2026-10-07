import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useMapState } from './useMapState'

/** Renders the hook inside a memory router and exposes the live location. */
function setup(initial = '/map/obs-1') {
  const result: { location: ReturnType<typeof useLocation> | null } = { location: null }
  const hookResult: { current: ReturnType<typeof useMapState> } = {
    current: undefined as unknown as ReturnType<typeof useMapState>,
  }
  function Probe() {
    hookResult.current = useMapState()
    result.location = useLocation()
    return null
  }
  const router = createMemoryRouter([{ path: '/map/:observationId?', element: <Probe /> }], {
    initialEntries: [initial],
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <>
      <RouterProvider router={router} />
      {children}
    </>
  )
  renderHook(() => null, { wrapper })
  return {
    get state() {
      return hookResult.current
    },
    get search() {
      return result.location?.search ?? ''
    },
    router,
  }
}

describe('useMapState', () => {
  it('reads state from the URL', () => {
    const view = setup('/map/obs-1?src=drone&conf=60&d=det-4&bm=satellite')
    expect(view.state.filters.source).toBe('drone')
    expect(view.state.filters.minConfidence).toBeCloseTo(0.6, 10)
    expect(view.state.detectionId).toBe('det-4')
    expect(view.state.basemap).toBe('satellite')
  })

  it('writes filters, selection, basemap and layers back to the URL', () => {
    const view = setup()
    act(() => view.state.setFilters({ minConfidence: 0.7 }, { replace: true }))
    expect(view.search).toBe('?conf=70')
    act(() => view.state.selectDetection('det-9'))
    expect(new URLSearchParams(view.search).get('d')).toBe('det-9')
    act(() => view.state.selectHotspot('hotspot-1'))
    const params = new URLSearchParams(view.search)
    expect(params.get('h')).toBe('hotspot-1')
    expect(params.get('d')).toBeNull()
    act(() => view.state.setBasemap('satellite'))
    act(() => view.state.toggleLayer('density'))
    expect(new URLSearchParams(view.search).get('bm')).toBe('satellite')
    expect(new URLSearchParams(view.search).get('layers')).toBe(
      'detections,density,hotspots,footprint',
    )
  })

  it('clears the hotspot when filters change, and resets filters', () => {
    const view = setup('/map/obs-1?h=hotspot-2&src=satellite')
    act(() => view.state.setFilters({ levels: ['critical'] }))
    expect(new URLSearchParams(view.search).get('h')).toBeNull()
    act(() => view.state.resetFilters())
    expect(view.search).toBe('')
  })

  it('replaces history for slider changes and pushes for selections', () => {
    const view = setup()
    const startIndex = view.router.state.historyAction
    act(() => view.state.setFilters({ minConfidence: 0.5 }, { replace: true }))
    expect(view.router.state.historyAction).toBe('REPLACE')
    act(() => view.state.selectDetection('det-1'))
    expect(view.router.state.historyAction).toBe('PUSH')
    expect(startIndex).toBe('POP')
  })

  it('drops the fresh flag', () => {
    const view = setup('/map/obs-1?fresh=1&conf=40')
    expect(view.state.fresh).toBe(true)
    act(() => view.state.clearFresh())
    expect(view.search).toBe('?conf=40')
  })
})
