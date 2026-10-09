import { describe, expect, it } from 'vitest'
import { MAP_LAYER_IDS } from './map/layers'
import { isTypingTarget, LAYER_SHORTCUTS, SHORTCUT_GROUPS, shortcutKey } from './shortcuts'

const event = (key: string, target: EventTarget | null = document.body, extra = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  defaultPrevented: false,
  target,
  ...extra,
})

describe('shortcutKey', () => {
  it('reads single keys, lower-cased, including "?"', () => {
    expect(shortcutKey(event('F'))).toBe('f')
    expect(shortcutKey(event('?'))).toBe('?')
    expect(shortcutKey(event('1'))).toBe('1')
    expect(shortcutKey(event('Escape'))).toBeNull()
  })

  it('stays out of the way of typing, modifiers and handled events', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    for (const target of [input, textarea, select])
      expect(shortcutKey(event('f', target))).toBeNull()
    expect(shortcutKey(event('f', document.body, { ctrlKey: true }))).toBeNull()
    expect(shortcutKey(event('f', document.body, { metaKey: true }))).toBeNull()
    expect(shortcutKey(event('f', document.body, { altKey: true }))).toBeNull()
    expect(shortcutKey(event('f', document.body, { defaultPrevented: true }))).toBeNull()
  })

  it('still works on checkboxes, radios and sliders', () => {
    for (const type of ['checkbox', 'radio', 'range']) {
      const input = document.createElement('input')
      input.type = type
      expect(isTypingTarget(input)).toBe(false)
    }
  })
})

describe('shortcut list', () => {
  it('maps 1 to 4 to every layer once', () => {
    expect(Object.values(LAYER_SHORTCUTS).sort()).toEqual([...MAP_LAYER_IDS].sort())
  })

  it('lists every key the handlers use', () => {
    const listed = SHORTCUT_GROUPS.flatMap((g) => g.shortcuts.flatMap((s) => s.keys)).map((k) =>
      k.toLowerCase(),
    )
    for (const key of ['?', 'f', 'l', ...Object.keys(LAYER_SHORTCUTS)])
      expect(listed).toContain(key)
  })
})
