import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
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

const EASE = [0.16, 1, 0.3, 1] as const

/**
 * Right-side panel that becomes a bottom sheet under 768px. No dimming backdrop, so the map
 * stays visible. Focus moves in on open, Tab stays inside, Escape closes, and focus returns
 * to the element that opened it.
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

  const offset = isDesktop ? { x: 24, y: 0 } : { x: 0, y: 32 }

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
          transition={{ duration: 0.18, ease: EASE }}
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-popover focus:outline-none',
            isDesktop
              ? cn(
                  'right-0 bottom-0 w-drawer max-w-full border-l border-border',
                  placement === 'below-topbar' ? 'top-[var(--spacing-topbar)]' : 'top-0',
                )
              : 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card border-t border-border',
            className,
          )}
        >
          {isDesktop ? null : (
            <span
              aria-hidden
              className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong"
            />
          )}
          <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-heading text-ink">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-0.5 text-small text-ink-muted">
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
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
              {footer}
            </footer>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
