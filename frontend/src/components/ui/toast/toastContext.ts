import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'success' | 'warning' | 'danger'

export interface ToastOptions {
  title: string
  description?: string
  tone?: ToastTone
  /** Milliseconds before it closes on its own. 0 keeps it until dismissed. */
  duration?: number
  action?: { label: string; onClick: () => void }
}

export interface ToastRecord extends ToastOptions {
  id: string
  tone: ToastTone
  duration: number
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  show: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

export const TOAST_DEFAULT_DURATION_MS = 5000
export const TOAST_MAX_VISIBLE = 3

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside ToastProvider.')
  return api
}
