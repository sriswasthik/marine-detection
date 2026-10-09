import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

type TriggerProps = { 'aria-describedby'?: string }

interface TooltipProps {
  content: ReactNode
  /** One focusable element. It receives aria-describedby. */
  children: ReactElement<TriggerProps>
  side?: 'top' | 'bottom'
  align?: 'center' | 'start' | 'end'
  /** Hover delay in ms. Keyboard focus shows the tooltip at once. */
  delay?: number
  className?: string
  /** Classes for the wrapper around the trigger, for example `flex w-full` for list rows. */
  wrapperClassName?: string
}

const SIDE = { top: 'bottom-full mb-2', bottom: 'top-full mt-2' } as const
const ALIGN = {
  center: 'left-1/2 -translate-x-1/2',
  start: 'left-0',
  end: 'right-0',
} as const

/**
 * A label plate on hover and focus: sheet, hairline, popover shadow. Put figures in `.data` so they
 * read in mono. Escape hides it.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delay = 250,
  className,
  wrapperClassName,
}: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const clear = () => window.clearTimeout(timer.current)
  const show = (immediate: boolean) => {
    clear()
    if (immediate) setOpen(true)
    else timer.current = window.setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    clear()
    setOpen(false)
  }

  useEffect(() => clear, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const describedBy = [children.props['aria-describedby'], id].filter(Boolean).join(' ')

  return (
    <span
      className={cn('relative inline-flex', wrapperClassName)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(false)}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-64 border border-hairline bg-raised px-3 py-2',
          'text-left text-small font-normal tracking-normal whitespace-normal text-ink normal-case shadow-popover',
          'animate-[tooltip-in_120ms_var(--ease-out)]',
          SIDE[side],
          ALIGN[align],
          className,
        )}
      >
        {content}
      </span>
    </span>
  )
}
