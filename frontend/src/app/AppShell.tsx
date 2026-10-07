import { motion, useReducedMotion } from 'framer-motion'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { useRememberRouteObservation } from '@/features/observations/currentObservationContext'
import { TopBar } from './shell/TopBar'

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-control bg-surface px-3 py-2 text-small font-medium text-ink shadow-popover focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70]"
    >
      Skip to content
    </a>
  )
}

/** Top bar plus the routed page, with a 150ms fade between routes. */
export function AppShell() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  useRememberRouteObservation()

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <TopBar />
      <main
        id="main"
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col focus-visible:outline-none"
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Outlet />
        </motion.div>
      </main>
      <ScrollRestoration />
    </div>
  )
}
