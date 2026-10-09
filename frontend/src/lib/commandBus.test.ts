import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerCommand, resetCommands, sendCommand } from './commandBus'

afterEach(resetCommands)

describe('command bus', () => {
  it('runs a command at once when a page handles it', () => {
    const fit = vi.fn()
    registerCommand('map.fit', fit)
    expect(sendCommand('map.fit')).toBe(true)
    expect(fit).toHaveBeenCalledOnce()
  })

  it('keeps a command until its page registers, then runs it once', () => {
    expect(sendCommand('map.toggle-density')).toBe(false)
    const toggle = vi.fn()
    registerCommand('map.toggle-density', toggle)
    expect(toggle).toHaveBeenCalledOnce()
    registerCommand('map.toggle-density', toggle)
    expect(toggle).toHaveBeenCalledOnce()
  })

  it('stops calling a handler once it is removed, and uses the latest one', () => {
    const first = vi.fn()
    const second = vi.fn()
    const removeFirst = registerCommand('export.geojson', first)
    registerCommand('export.geojson', second)
    sendCommand('export.geojson')
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    removeFirst()
    sendCommand('export.geojson')
    expect(first).not.toHaveBeenCalled()
  })
})
