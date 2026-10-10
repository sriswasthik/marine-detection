import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { matchPath, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { useRememberRouteObservation } from '@/features/observations/currentObservationContext'
import { useShortcuts } from '@/hooks/useShortcuts'
import { CommandPalette } from './shell/CommandPalette'
import { DriftForecast } from './shell/DriftForecast'
import { MoreSheet } from './shell/MoreSheet'
import { CommandPaletteContext } from './shell/paletteContext'
import { PrimaryActionContext } from './shell/primaryAction'
import { BottomTabBar } from './shell/PrimaryNav'
import { ShortcutsDialog } from './shell/ShortcutsDialog'
import { ShortcutsDialogContext } from './shell/shortcutsContext'
import { TopBar } from './shell/TopBar'

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-control bg-raised px-3 py-2 text-small font-medium text-ink shadow-popover focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70]"
    >
      Skip to content
    </a>
  )
}

/** The design's one easing curve, for framer-motion. */
const EASE = [0.2, 0.7, 0.2, 1] as const

/**
 * Top bar, the routed page (a 160ms fade with a 4px rise between routes), the phone tab bar, and
 * the app-wide dialogs: the command palette (Ctrl or Cmd + K) and the shortcuts list ("?").
 */
export function AppShell() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  useRememberRouteObservation()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  // How many parts of the view show their own primary button (see shell/primaryAction.ts).
  const [primaryClaims, setPrimaryClaims] = useState(0)
  const claimPrimary = useCallback(() => {
    setPrimaryClaims((count) => count + 1)
    return () => setPrimaryClaims((count) => count - 1)
  }, [])
  const primaryAction = useMemo(
    () => ({ claimed: primaryClaims > 0, claim: claimPrimary }),
    [primaryClaims, claimPrimary],
  )
  useShortcuts(useMemo(() => ({ '?': openShortcuts }), [openShortcuts]))

  // Ctrl or Cmd + K toggles the palette from anywhere, even while typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <ShortcutsDialogContext value={openShortcuts}>
      <CommandPaletteContext value={openPalette}>
        <PrimaryActionContext value={primaryAction}>
          <div className="flex min-h-dvh flex-col">
            <SkipLink />
            <TopBar />
            <main
              id="main"
              tabIndex={-1}
              className="flex min-h-0 flex-1 flex-col pb-[var(--tabbar-offset)] focus-visible:outline-none print:pb-0"
            >
              <motion.div
                key={location.pathname}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: EASE }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <Outlet />
              </motion.div>
            </main>
            <BottomTabBar onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
            <ScrollRestoration />
            <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
            <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
            {matchPath('/map/:observationId?', location.pathname) && <DriftForecast />}
          </div>
        </PrimaryActionContext>
      </CommandPaletteContext>
    </ShortcutsDialogContext>
  )
}
