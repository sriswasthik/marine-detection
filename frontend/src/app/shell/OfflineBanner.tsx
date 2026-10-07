import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Banner, useToast } from '@/components/ui'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/** Set on <html> to the bar's height, so full-height pages (the map) can make room for it. */
const OFFLINE_BAR_VAR = '--offline-bar-height'

/**
 * A quiet bar under the top bar while the device is offline. Requests fail at once with a
 * recoverable error meanwhile (see withResilience); when the connection returns, anything that
 * failed loads again. `preview` shows it regardless, for the design review page.
 */
export function OfflineBanner({ preview = false }: { preview?: boolean }) {
  const online = useOnlineStatus()
  const queryClient = useQueryClient()
  const toast = useToast()
  const wasOnline = useRef(online)
  const barRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (preview) return
    if (online && !wasOnline.current) {
      void queryClient.refetchQueries({
        type: 'active',
        predicate: (query) => query.state.status === 'error',
      })
      toast.show({ title: 'Back online', tone: 'success', duration: 3000 })
    }
    wasOnline.current = online
  }, [online, preview, queryClient, toast])

  useEffect(() => {
    const root = document.documentElement
    const bar = barRef.current
    if (online || preview || !bar) return
    const measure = () => root.style.setProperty(OFFLINE_BAR_VAR, `${bar.offsetHeight}px`)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(bar)
    return () => {
      observer?.disconnect()
      root.style.removeProperty(OFFLINE_BAR_VAR)
    }
  }, [online, preview])

  if (online && !preview) return null
  return (
    <div ref={barRef}>
      <Banner variant="bar" tone="warning" title="You're offline">
        What is on screen stays available. New requests will fail until you reconnect.
      </Banner>
    </div>
  )
}
