import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { getFocusable } from '@/lib/focus'
import { IconButton } from './IconButton'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Element to focus on open. Defaults to the panel itself. */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** `below-topbar` keeps the app bar visible; `full` covers the full height. */
  placement?: 'below-topbar' | 'full'
  className?: string
}

/** The one easing curve (tokens.css --ease-out). */
const EASE = [0.2, 0.7, 0.2, 1] as const

/**
 * Right-side panel that becomes a bottom sheet under 768px. No dimming backdrop, so the map
 * stays visible. The sheet opens at half height (lib/map/occlusion.ts SHEET_PEEK_FRACTION) and
 * its handle expands it. Focus moves in on open, Tab stays inside, Escape closes, and focus
 * returns to the element that opened it.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  placement = 'below-topbar',
  className,
}: DrawerProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const requestClose = useEffectEvent(() => onClose())
  const [expanded, setExpanded] = useState(false)
  // Every opening starts at half height, so the map above stays in view.
  const [openedFor, setOpenedFor] = useState(open)
  if (open !== openedFor) {
    setOpenedFor(open)
    if (open) setExpanded(false)
  }

  // Move focus in on open; give it back on close.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const target = initialFocusRef?.current ?? panelRef.current
    target?.focus({ preventScroll: true })
    return () => {
      if (previous && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [open, initialFocusRef])

  // Escape closes, unless a nested control (menu, tooltip) already handled it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        requestClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const trapTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panelRef.current) return
    const focusable = getFocusable(panelRef.current)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) {
      event.preventDefault()
      return
    }
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const offset = isDesktop ? { x: 16, y: 0 } : { x: 0, y: 16 }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="drawer"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          onKeyDown={trapTab}
          initial={{ opacity: 0, ...offset }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, ...offset }}
          transition={{ duration: 0.2, ease: EASE }}
          className={cn(
            'fixed z-50 flex flex-col rounded-none bg-white shadow-popover focus:outline-none',
            isDesktop
              ? cn(
                  'right-0 bottom-0 w-drawer max-w-full border-l border-hairline',
                  placement === 'below-topbar'
                    ? 'top-[calc(var(--spacing-topbar)+var(--offline-bar-height,0px))]'
                    : 'top-0',
                )
              : cn(
                  'inset-x-0 bottom-0 border-t border-hairline',
                  expanded ? 'max-h-[85dvh]' : 'max-h-[50dvh]',
                ),
            className,
          )}
        >
          {isDesktop ? null : (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Show less of the panel' : 'Show more of the panel'}
              onClick={() => setExpanded((value) => !value)}
              className="group mx-auto flex h-6 w-16 shrink-0 items-center justify-center"
            >
              <span aria-hidden className="h-1 w-8 bg-rule group-hover:bg-ink-2" />
            </button>
          )}
          <div className="flex shrink-0 items-start gap-3 border-b border-hairline px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-title text-ink">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-small text-ink-2">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton
              label="Close"
              icon={<X aria-hidden />}
              size="sm"
              onClick={onClose}
              tooltip={false}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline px-6 py-3">
              {footer}
            </footer>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
