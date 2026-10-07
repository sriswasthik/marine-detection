import { describe, expect, it } from 'vitest'
import { observationIdFromPath, pathForObservation } from './routes'

describe('observation routes', () => {
  it('reads the observation id from map, detail and report paths', () => {
    expect(observationIdFromPath('/map/obs-1')).toBe('obs-1')
    expect(observationIdFromPath('/observations/obs-2')).toBe('obs-2')
    expect(observationIdFromPath('/observations/obs-3/report')).toBe('obs-3')
    expect(observationIdFromPath('/map')).toBeNull()
    expect(observationIdFromPath('/settings')).toBeNull()
  })

  it('keeps the page type when switching observation', () => {
    expect(pathForObservation('/observations/a/report', 'b')).toBe('/observations/b/report')
    expect(pathForObservation('/observations/a', 'b')).toBe('/observations/b')
    expect(pathForObservation('/map/a', 'b')).toBe('/map/b')
    expect(pathForObservation('/settings', 'b')).toBe('/map/b')
    expect(pathForObservation('/', 'id with space')).toBe('/map/id%20with%20space')
  })
})
