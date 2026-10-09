/**
 * Page actions the command palette can trigger (fit the map, toggle a layer, export). A page
 * registers handlers while it is mounted. A command sent before its page is open waits, and runs
 * once the page registers a handler for it, so the palette can navigate first and act after.
 */

export type PageCommand = 'map.fit' | 'map.toggle-density' | 'export.geojson'

type Handler = () => void

const handlers = new Map<PageCommand, Set<Handler>>()
let pending: PageCommand | null = null

/** Runs the command now if a page handles it, else keeps it until one does. */
export function sendCommand(command: PageCommand): boolean {
  const set = handlers.get(command)
  const handler = set ? [...set].at(-1) : undefined
  if (handler) {
    pending = null
    handler()
    return true
  }
  pending = command
  return false
}

/** Registers a handler; returns the function that removes it. Runs a waiting command at once. */
export function registerCommand(command: PageCommand, handler: Handler): () => void {
  const set = handlers.get(command) ?? new Set<Handler>()
  set.add(handler)
  handlers.set(command, set)
  if (pending === command) {
    pending = null
    handler()
  }
  return () => {
    set.delete(handler)
  }
}

/** For tests: forget handlers and any waiting command. */
export function resetCommands(): void {
  handlers.clear()
  pending = null
}
