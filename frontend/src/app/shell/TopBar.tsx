import { ScanSearch, Search } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Logomark } from '@/components/brand/Logomark'
import { buttonStyles, Kbd } from '@/components/ui'
import { cn } from '@/lib/cn'
import { BRAND } from '@/lib/brand'
import { ENV } from '@/lib/env'
import { ANALYZE_LABEL } from '../navigation'
import { OfflineBanner } from './OfflineBanner'
import { modifierKeyLabel, useOpenCommandPalette } from './paletteContext'
import { usePrimaryAction } from './primaryAction'
import { PrimaryNav } from './PrimaryNav'

/**
 * 52px on Concrete with a hairline underneath: the logomark and the A.W.A.R.E. wordmark (the full
 * name only on the Overview from 1440px), the sections as plain text, then the view's one primary
 * action and the palette hint. Under 900px the sections move to the bottom tab bar. Where the
 * figures come from ("Sample data") is labelled on each page's content.
 */
export function TopBar() {
  const { pathname } = useLocation()
  const openPalette = useOpenCommandPalette()
  // A view with its own primary (Run detection, View evidence) takes the top bar's place.
  const { claimed } = usePrimaryAction()
  const onOverview = pathname === '/'

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper print:hidden">
      <div className="flex h-topbar items-center gap-4 px-4 sm:px-6 xl:gap-8 xl:px-8">
        <Link
          to="/"
          aria-label={`${ENV.appName}, ${BRAND.long}, overview`}
          className="flex min-h-10 shrink-0 items-center gap-3 rounded-control"
        >
          <Logomark />
          <span className="flex items-baseline gap-3">
            <span className="text-small font-semibold tracking-[0.08em] text-tar">
              {ENV.appName}
            </span>
            {onOverview ? (
              <span className="hidden text-small text-ink-2 min-[1440px]:inline">{BRAND.long}</span>
            ) : null}
          </span>
        </Link>

        <PrimaryNav className="hidden nav:block" />

        <div className="ml-auto flex min-w-0 items-center gap-3">
          {claimed ? null : (
            <Link
              to="/analyze"
              aria-label={ANALYZE_LABEL}
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
            >
              <ScanSearch aria-hidden />
              <span className="max-sm:hidden">{ANALYZE_LABEL}</span>
              <span aria-hidden className="sm:hidden">
                Analyze
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open the command palette"
            aria-keyshortcuts="Control+K Meta+K"
            className={cn(
              'hidden h-8 items-center gap-2 rounded-control px-2 text-ink-2 hover:bg-ink/5 hover:text-ink nav:inline-flex',
            )}
          >
            <Search aria-hidden className="size-4" />
            <span className="flex gap-1">
              <Kbd>{modifierKeyLabel()}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        </div>
      </div>
      <OfflineBanner />
    </header>
  )
}
