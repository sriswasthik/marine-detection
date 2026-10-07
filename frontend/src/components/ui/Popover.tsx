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
import { getFocusable } from '@/lib/focus'

export interface PopoverTriggerProps {
  ref: Ref<HTMLButtonElement>
  'aria-expanded': boolean
  'aria-controls': string | undefined
  'aria-haspopup': 'dialog'
  onClick: () => void
}

export interface PopoverProps {
  /** Renders the trigger. Spread the props onto a button. */
  trigger: (props: PopoverTriggerProps) => ReactNode
  /** Accessible name of the panel. */
  label: string
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
  panelClassName?: string
}

/**
 * Small non-modal panel anchored to a trigger. Focus moves in on open; Escape or a click
 * outside closes it, and Escape returns focus to the trigger.
 */
export function Popover({
  trigger,
  label,
  children,
  align = 'start',
  className,
  panelClassName,
}: PopoverProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open || !panelRef.current) return
    const first = getFocusable(panelRef.current)[0]
    ;(first ?? panelRef.current).focus()
  }, [open])

  const onOutsidePointer = useEffectEvent((event: PointerEvent) => {
    if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false)
  })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => onOutsidePointer(event)
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      {trigger({
        ref: triggerRef,
        'aria-expanded': open,
        'aria-controls': open ? panelId : undefined,
        'aria-haspopup': 'dialog',
        onClick: () => setOpen((value) => !value),
      })}
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            'absolute top-full z-50 mt-1.5 rounded-card border border-border bg-surface p-3 shadow-popover focus:outline-none',
            'animate-[tooltip-in_120ms_var(--ease-out)]',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
