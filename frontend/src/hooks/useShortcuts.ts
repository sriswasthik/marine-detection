import { useEffect, useEffectEvent } from 'react'
import { shortcutKey } from '@/lib/shortcuts'

/**
 * Runs `handlers[key]` for single-key shortcuts (lower-case keys, for example "f", "1", "?").
 * Ignored while typing in a field, with Ctrl, Alt or Meta held, or when another handler already
 * took the event.
 */
export function useShortcuts(handlers: Readonly<Record<string, () => void>>, enabled = true): void {
  const run = useEffectEvent((event: KeyboardEvent) => {
    const key = shortcutKey(event)
    const handler = key ? handlers[key] : undefined
    if (!handler) return
    event.preventDefault()
    handler()
  })

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => run(event)
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
