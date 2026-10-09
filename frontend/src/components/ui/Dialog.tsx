import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useEffectEvent, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { getFocusable } from '@/lib/focus'
import { IconButton } from './IconButton'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Centred modal dialog. Like the Drawer, it does not dim the page: a clear layer behind it
 * catches outside clicks. Focus moves in on open, Tab stays inside, Escape closes, and focus
 * returns to where it was.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const reduceMotion = useReducedMotion()
  const requestClose = useEffectEvent(() => onClose())

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      if (previous && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [open])

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

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="dialog"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduceMotion ? 1 : 0 }}
          transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div aria-hidden className="absolute inset-0 bg-tar/10" onClick={onClose} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            onKeyDown={trapTab}
            className={cn(
              'relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-panel border border-hairline bg-raised shadow-popover focus:outline-none',
              className,
            )}
          >
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
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
