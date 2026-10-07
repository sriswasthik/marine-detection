import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import {
  TOAST_DEFAULT_DURATION_MS,
  TOAST_MAX_VISIBLE,
  ToastContext,
  type ToastApi,
  type ToastRecord,
  type ToastTone,
} from './toastContext'

const TONE_ICONS: Record<ToastTone, { Icon: typeof Info; className: string }> = {
  info: { Icon: Info, className: 'text-accent' },
  success: { Icon: CircleCheck, className: 'text-success' },
  warning: { Icon: TriangleAlert, className: 'text-warning' },
  danger: { Icon: CircleAlert, className: 'text-danger' },
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.duration)
  const startedAt = useRef(0)

  useEffect(() => {
    if (toast.duration <= 0 || paused) return
    startedAt.current = Date.now()
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, toast.duration, toast.id, onDismiss])

  const { Icon, className } = TONE_ICONS[toast.tone]
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-card border border-border bg-surface p-3 pr-2 shadow-popover"
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', className)} />
      <div className="min-w-0 flex-1">
        <p className="text-small font-medium text-ink">{toast.title}</p>
        {toast.description ? (
          <p className="text-small text-ink-muted">{toast.description}</p>
        ) : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onDismiss(toast.id)
            }}
            className="mt-1.5 rounded-control text-small font-medium text-accent hover:text-accent-hover hover:underline"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-ink/5 hover:text-ink"
      >
        <X aria-hidden className="size-4" />
      </button>
    </motion.li>
  )
}

/** Provides useToast() and renders the toast stack. Toasts are announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback<ToastApi['show']>((options) => {
    counter.current += 1
    const id = `toast-${counter.current}`
    const record: ToastRecord = {
      ...options,
      id,
      tone: options.tone ?? 'info',
      duration: options.duration ?? TOAST_DEFAULT_DURATION_MS,
    }
    setToasts((current) => [...current, record].slice(-TOAST_MAX_VISIBLE))
    return id
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext value={api}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] sm:left-auto sm:w-[360px]"
      >
        <ol aria-live="polite" aria-relevant="additions text" className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </ol>
      </section>
    </ToastContext>
  )
}
