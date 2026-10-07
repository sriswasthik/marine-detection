import { Canvas } from 'leaflet'

/**
 * Leaflet 1.9 bug: Canvas._updatePaths redraws immediately and forgets a redraw already queued
 * for the next animation frame. If the map is removed before that frame (switching evidence views
 * quickly, leaving the page), the orphaned frame runs on a renderer whose context is gone and
 * throws. Skip redraws on a destroyed renderer. Applied once, on import.
 */
type CanvasInternals = { _ctx?: unknown; _redraw: () => void; __mwiGuarded?: boolean }

const proto = Canvas.prototype as unknown as CanvasInternals
if (!proto.__mwiGuarded) {
  const redraw = proto._redraw
  proto._redraw = function guardedRedraw(this: CanvasInternals) {
    if (!this._ctx) return
    redraw.call(this)
  }
  proto.__mwiGuarded = true
}
