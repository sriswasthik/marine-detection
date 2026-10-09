import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react'
import { IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'

/** The design's one easing curve, for framer-motion. */
const EASE = [0.2, 0.7, 0.2, 1] as const

export interface MapDrawerPanelProps {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  /** `side`: a 360px column right of the map. `bottom`: under 768px, a sheet under the map. */
  layout: 'side' | 'bottom'
}

/**
 * The map's detail panel, docked in the page grid: it takes its own space, so it never covers the
 * map, the controls or the attribution. Rendered only while something is selected. Focus moves in
 * on open and returns on close; Escape closes. Slides in over 200ms.
 */
export function MapDrawerPanel({
  title,
  description,
  children,
  footer,
  onClose,
  layout,
}: MapDrawerPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const requestClose = useEffectEvent(() => onClose())

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      if (previous && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  // Escape closes, unless a nested control (menu, tooltip, popover) already handled it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        requestClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const offset = layout === 'side' ? { x: 16 } : { y: 16 }
  return (
    <motion.section
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      data-chrome="drawer"
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={cn(
        'flex min-h-0 flex-col bg-white focus:outline-none',
        layout === 'side'
          ? 'h-full w-[360px] border-l border-hairline'
          : 'max-h-[45dvh] w-full border-t border-rule',
      )}
    >
      <div className="flex shrink-0 items-start gap-3 border-b border-hairline px-4 py-3">
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
          tooltip={false}
          onClick={onClose}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer ? (
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-hairline px-4 py-3">
          {footer}
        </footer>
      ) : null}
    </motion.section>
  )
}
