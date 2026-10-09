import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Kbd } from '@/components/ui'
import { ObservationGlyphById } from '@/features/observations/components/ObservationGlyphById'
import { cn } from '@/lib/cn'
import { pushRecent, rankItems } from '@/lib/fuzzy'
import { useCommandItems, type CommandItem } from './useCommandItems'

const RECENT_KEY = 'mwi.palette.recent'

/** Recent picks are a per-browser convenience: storage can be missing or blocked. */
function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeRecent(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids))
  } catch {
    // Not saved: the palette still works, it just forgets.
  }
}

/**
 * Ctrl or Cmd + K: search pages, observations and actions with fuzzy matching. Keyboard only:
 * arrows move, Enter opens, Escape closes. Recent picks come first. Focus stays in the search field
 * while it is open and returns to where it was when it closes.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return createPortal(<PaletteDialog onClose={onClose} />, document.body)
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const items = useCommandItems()
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState(readRecent)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const optionRefs = useRef<(HTMLDivElement | null)[]>([])
  const listId = useId()
  const titleId = useId()

  const results = useMemo(() => rankItems(items, query, recent), [items, query, recent])
  const recentCount = query.trim() ? 0 : results.filter((item) => recent.includes(item.id)).length
  const active = Math.min(activeIndex, Math.max(0, results.length - 1))

  // Focus in on open; back to where it was on close.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => {
      if (previous && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    optionRefs.current[active]?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const choose = (item: CommandItem) => {
    const next = pushRecent(recent, item.id)
    setRecent(next)
    writeRecent(next)
    onClose()
    item.run()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = results.length
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (count) setActiveIndex((active + 1) % count)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (count) setActiveIndex((active - 1 + count) % count)
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(Math.max(0, count - 1))
        break
      case 'Enter': {
        event.preventDefault()
        const item = results[active]
        if (item) choose(item)
        break
      }
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        onClose()
        break
      case 'Tab':
        // The search field is the only stop: focus stays in the palette.
        event.preventDefault()
        break
    }
  }

  const groupOf = (index: number, item: CommandItem) =>
    index < recentCount ? 'Recent' : item.group

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <div aria-hidden className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[70dvh] w-full max-w-xl flex-col rounded-panel border border-hairline bg-white shadow-popover"
      >
        <h2 id={titleId} className="sr-only">
          Command palette
        </h2>
        <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-4">
          <Search aria-hidden className="size-4 shrink-0 text-ink-2" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-label="Search pages, observations and actions"
            placeholder="Search pages, observations and actions"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-2 focus-visible:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        {results.length === 0 ? (
          <p className="px-4 py-6 text-body text-ink-2" role="status">
            Nothing matches “{query.trim()}”. Try a region, a date or a page name.
          </p>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label="Results"
            className="min-h-0 overflow-y-auto py-2"
          >
            {results.map((item, index) => {
              const group = groupOf(index, item)
              const previous = results[index - 1]
              const header = !query.trim() && (!previous || groupOf(index - 1, previous) !== group)
              return (
                <li
                  key={item.id}
                  role="presentation"
                  className={cn(header && index > 0 && 'mt-2 border-t border-hairline pt-2')}
                >
                  {header ? (
                    <p aria-hidden className="label px-4 pt-1 pb-2 text-ink-2">
                      {group}
                    </p>
                  ) : null}
                  <div
                    ref={(el) => {
                      optionRefs.current[index] = el
                    }}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onPointerMove={() => index !== active && setActiveIndex(index)}
                    onClick={() => choose(item)}
                    className={cn(
                      'flex min-h-10 cursor-pointer items-center gap-3 px-4 py-2 text-body text-ink',
                      index === active && 'bg-accent-wash',
                    )}
                  >
                    {item.observationId ? (
                      <ObservationGlyphById id={item.observationId} size={16} />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.detail ? (
                      <span className="data shrink-0 truncate text-ink-2">{item.detail}</span>
                    ) : null}
                    {query.trim() ? (
                      <span className="label shrink-0 text-ink-2">{item.group}</span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
