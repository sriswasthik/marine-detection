import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  /** Small count after the label, for example the number of detections. */
  count?: number
  disabled?: boolean
  content: ReactNode
}

export interface TabsProps<T extends string> {
  /** Accessible name of the tab list. */
  label: string
  items: readonly TabItem<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string
  panelClassName?: string
}

/** Tabs with automatic activation: arrows move and select, Home and End jump. */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onValueChange,
  className,
  panelClassName,
}: TabsProps<T>) {
  const baseId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = items.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0)
  const active = items.find((t) => t.value === value)

  const activate = (index: number | undefined) => {
    if (index === undefined) return
    const item = items[index]
    if (!item || item.disabled) return
    onValueChange(item.value)
    refs.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const position = enabled.indexOf(index)
    const keys: Record<string, number | undefined> = {
      ArrowRight: enabled[(position + 1) % enabled.length],
      ArrowLeft: enabled[(position - 1 + enabled.length) % enabled.length],
      Home: enabled[0],
      End: enabled[enabled.length - 1],
    }
    if (event.key in keys) {
      event.preventDefault()
      activate(keys[event.key])
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-5 overflow-x-auto border-b border-border [scrollbar-width:none]"
      >
        {items.map((item, index) => {
          const selected = item.value === value
          return (
            <button
              key={item.value}
              ref={(el) => {
                refs.current[index] = el
              }}
              id={`${baseId}-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => activate(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'relative -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-small font-medium whitespace-nowrap',
                'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="num rounded-badge bg-bg px-1.5 text-caption text-ink-muted">
                  {item.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.value}`}
          aria-labelledby={`${baseId}-tab-${active.value}`}
          tabIndex={0}
          className={cn('pt-4 focus-visible:outline-offset-4', panelClassName)}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  )
}
