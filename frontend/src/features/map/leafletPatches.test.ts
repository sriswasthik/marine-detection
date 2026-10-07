import { Canvas } from 'leaflet'
import { describe, expect, it } from 'vitest'
import './leafletPatches'

describe('Leaflet canvas guard', () => {
  it('skips a redraw on a renderer whose context was destroyed', () => {
    const renderer = new Canvas() as unknown as { _ctx?: unknown; _redraw: () => void }
    renderer._ctx = undefined
    expect(() => renderer._redraw()).not.toThrow()
  })
})
