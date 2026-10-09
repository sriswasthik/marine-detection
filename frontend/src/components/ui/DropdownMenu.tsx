import { Check } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { cn } from '@/lib/cn'

export interface DropdownMenuItem {
  type?: 'item'
  id: string
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Makes the item a radio item, for picking one of several. */
  checked?: boolean
  disabled?: boolean
  shortcut?: string
  /** A short note on the right, such as a file type. */
  aside?: string
  tone?: 'default' | 'danger'
  onSelect: () => void
}

export type DropdownMenuEntry =
  | DropdownMenuItem
  | { type: 'separator'; id: string }
  | { type: 'label'; id: string; label: ReactNode }

export interface DropdownTriggerProps {
  ref: Ref<HTMLButtonElement>
  id: string
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string | undefined
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export interface DropdownMenuProps {
  /** Renders the trigger. Spread the props onto a button. */
  trigger: (props: DropdownTriggerProps) => ReactNode
  items: readonly DropdownMenuEntry[]
  align?: 'start' | 'end'
  /** Open below the trigger (default) or above it, for triggers near the bottom of the screen. */
  side?: 'bottom' | 'top'
  className?: string
  menuClassName?: string
}

const isItem = (entry: DropdownMenuEntry): entry is DropdownMenuItem =>
  entry.type === undefined || entry.type === 'item'

/**
 * Menu button. Enter, Space or Arrow Down open on the first item, Arrow Up on the last.
 * Arrows move, Home and End jump, Escape closes and returns focus, Tab closes.
 */
export function DropdownMenu({
  trigger,
  items,
  align = 'start',
  side = 'bottom',
  className,
  menuClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerId = useId()
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  const actionable = items.filter(isItem)
  const indexById = new Map(actionable.map((item, index) => [item.id, index]))
  const enabledIndexes = actionable.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0)

  const openAt = (position: 'first' | 'last') => {
    setOpen(true)
    setActiveIndex(
      position === 'first'
        ? (enabledIndexes[0] ?? -1)
        : (enabledIndexes[enabledIndexes.length - 1] ?? -1),
    )
  }

  const close = (returnFocus: boolean) => {
    setOpen(false)
    setActiveIndex(-1)
    if (returnFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  const onOutsidePointer = useEffectEvent((event: PointerEvent) => {
    if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false)
  })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => onOutsidePointer(event)
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const move = (delta: number) => {
    if (enabledIndexes.length === 0) return
    const position = enabledIndexes.indexOf(activeIndex)
    const next = enabledIndexes[(position + delta + enabledIndexes.length) % enabledIndexes.length]
    if (next !== undefined) setActiveIndex(next)
  }

  const choose = (item: DropdownMenuItem) => {
    if (item.disabled) return
    close(true)
    item.onSelect()
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAt('first')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAt('last')
    }
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(enabledIndexes[0] ?? -1)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1)
        break
      case 'Escape':
        event.preventDefault()
        close(true)
        break
      case 'Tab':
        close(false)
        break
      case 'Enter':
      case ' ': {
        event.preventDefault()
        const item = actionable[activeIndex]
        if (item) choose(item)
        break
      }
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      {trigger({
        ref: triggerRef,
        id: triggerId,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: () => (open ? close(false) : openAt('first')),
        onKeyDown: onTriggerKeyDown,
      })}
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-50 max-h-[min(24rem,70dvh)] min-w-52 overflow-y-auto rounded-panel border border-hairline bg-raised py-1 shadow-popover',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            'animate-[tooltip-in_120ms_var(--ease-out)]',
            align === 'end' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {items.map((entry) => {
            if (entry.type === 'separator') {
              return <div key={entry.id} role="separator" className="my-1 h-px bg-hairline" />
            }
            if (entry.type === 'label') {
              return (
                <div key={entry.id} role="presentation" className="label px-3 pt-2 pb-1 text-ink-2">
                  {entry.label}
                </div>
              )
            }
            const index = indexById.get(entry.id) ?? -1
            const radio = entry.checked !== undefined
            return (
              <div
                key={entry.id}
                ref={(el) => {
                  itemRefs.current[index] = el
                }}
                role={radio ? 'menuitemradio' : 'menuitem'}
                aria-checked={radio ? entry.checked : undefined}
                aria-disabled={entry.disabled || undefined}
                tabIndex={-1}
                onClick={() => choose(entry)}
                onPointerMove={() =>
                  !entry.disabled && index !== activeIndex && setActiveIndex(index)
                }
                className={cn(
                  'flex cursor-pointer items-start gap-3 px-3 py-2 text-body outline-none select-none',
                  'focus:bg-accent-wash [&_svg]:size-4 [&_svg]:shrink-0',
                  entry.tone === 'danger' ? 'text-danger' : 'text-ink',
                  entry.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {entry.icon ? (
                  <span aria-hidden className="mt-1 text-ink-2">
                    {entry.icon}
                  </span>
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{entry.label}</span>
                  {entry.description ? (
                    <span className="text-small text-ink-2">{entry.description}</span>
                  ) : null}
                </span>
                {entry.shortcut ? (
                  <span className="mt-1 text-small text-ink-2">{entry.shortcut}</span>
                ) : null}
                {entry.aside ? <span className="data text-ink-2">{entry.aside}</span> : null}
                {radio ? (
                  <Check
                    aria-hidden
                    className={cn(
                      'mt-1 text-accent-ink',
                      entry.checked ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
