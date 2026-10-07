import { describe, expect, it } from 'vitest'
import {
  clampSwipe,
  SWIPE_DEFAULT,
  SWIPE_LARGE_STEP,
  SWIPE_STEP,
  swipeClipPath,
  swipeFromKey,
  swipeFromPointer,
} from './swipe'

describe('swipeFromPointer', () => {
  const rect = { left: 100, width: 400 }

  it('maps the pointer to a percentage of the viewer width', () => {
    expect(swipeFromPointer(100, rect)).toBe(0)
    expect(swipeFromPointer(300, rect)).toBe(50)
    expect(swipeFromPointer(400, rect)).toBe(75)
    expect(swipeFromPointer(500, rect)).toBe(100)
  })

  it('clamps when the pointer leaves the viewer', () => {
    expect(swipeFromPointer(40, rect)).toBe(0)
    expect(swipeFromPointer(900, rect)).toBe(100)
  })

  it('falls back to the middle for a viewer with no width', () => {
    expect(swipeFromPointer(120, { left: 100, width: 0 })).toBe(SWIPE_DEFAULT)
  })
})

describe('swipeFromKey', () => {
  it('moves by one step with the arrow keys', () => {
    expect(swipeFromKey('ArrowRight', 50)).toBe(50 + SWIPE_STEP)
    expect(swipeFromKey('ArrowUp', 50)).toBe(50 + SWIPE_STEP)
    expect(swipeFromKey('ArrowLeft', 50)).toBe(50 - SWIPE_STEP)
    expect(swipeFromKey('ArrowDown', 50)).toBe(50 - SWIPE_STEP)
  })

  it('moves by a large step with Shift or Page keys', () => {
    expect(swipeFromKey('ArrowRight', 50, { large: true })).toBe(50 + SWIPE_LARGE_STEP)
    expect(swipeFromKey('PageUp', 50)).toBe(50 + SWIPE_LARGE_STEP)
    expect(swipeFromKey('PageDown', 50)).toBe(50 - SWIPE_LARGE_STEP)
  })

  it('jumps to the edges and never goes past them', () => {
    expect(swipeFromKey('Home', 50)).toBe(0)
    expect(swipeFromKey('End', 50)).toBe(100)
    expect(swipeFromKey('ArrowRight', 99)).toBe(100)
    expect(swipeFromKey('ArrowLeft', 1)).toBe(0)
  })

  it('ignores other keys', () => {
    expect(swipeFromKey('Enter', 50)).toBeNull()
    expect(swipeFromKey('a', 50)).toBeNull()
  })
})

describe('clampSwipe and swipeClipPath', () => {
  it('keeps values within 0 to 100', () => {
    expect(clampSwipe(-5)).toBe(0)
    expect(clampSwipe(140)).toBe(100)
    expect(clampSwipe(Number.NaN)).toBe(SWIPE_DEFAULT)
  })

  it('clips the top layer to the left of the divider', () => {
    expect(swipeClipPath(30)).toBe('inset(0 70% 0 0)')
    expect(swipeClipPath(100)).toBe('inset(0 0% 0 0)')
  })
})
