/**
 * Keyboard shortcuts: one list, shared by the handlers and the "?" dialog, so they cannot drift.
 * Shortcuts never fire while typing in a field or with Ctrl, Alt or Meta held.
 */
import type { MapLayerId } from './map/layers'

export interface ShortcutInfo {
  /** Keys as shown in the dialog. */
  keys: readonly string[]
  description: string
}

export interface ShortcutGroup {
  title: string
  shortcuts: readonly ShortcutInfo[]
}

/** Map page keys for the four layers, in the order of the layer panel. */
export const LAYER_SHORTCUTS: Readonly<Record<string, MapLayerId>> = {
  '1': 'detections',
  '2': 'density',
  '3': 'hotspots',
  '4': 'footprint',
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Anywhere',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Search pages, observations and actions' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close the open drawer, menu or dialog' },
      {
        keys: ['Tab'],
        description: 'Move to the next control; the first stop skips to the page content',
      },
    ],
  },
  {
    title: 'Map',
    shortcuts: [
      { keys: ['F'], description: 'Fit the map to the detections' },
      { keys: ['L'], description: 'Show or hide the legend' },
      { keys: ['1'], description: 'Show or hide detections' },
      { keys: ['2'], description: 'Show or hide the density grid' },
      { keys: ['3'], description: 'Show or hide hotspots' },
      { keys: ['4'], description: 'Show or hide the image footprint' },
      { keys: ['+', '−'], description: 'Zoom in or out, when the map has focus' },
      { keys: ['←', '↑', '→', '↓'], description: 'Pan, when the map has focus' },
    ],
  },
]

export interface KeyEventLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  defaultPrevented: boolean
  target: EventTarget | null
}

/** True while focus is somewhere text is typed or a choice is made with letter keys. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false
  const element = target as HTMLElement
  if (element.isContentEditable) return true
  return Boolean(
    element.closest(
      'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select',
    ),
  )
}

/**
 * The shortcut key an event stands for, lower-cased, or null when it must be left alone:
 * already handled, a modifier held (except Shift, which "?" needs), or typing in a field.
 */
export function shortcutKey(event: KeyEventLike): string | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null
  if (isTypingTarget(event.target)) return null
  return event.key.length === 1 ? event.key.toLowerCase() : null
}
