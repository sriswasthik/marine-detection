import { Menu, ScanSearch } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logomark } from '@/components/brand/Logomark'
import { buttonStyles, Divider, Drawer, IconButton, Tooltip } from '@/components/ui'
import { ObservationChip } from '@/features/observations/components/ObservationChip'
import { ENV } from '@/lib/env'
import { ModeChip } from './ModeChip'
import { OfflineBanner } from './OfflineBanner'
import { PrimaryNav, SheetNav } from './PrimaryNav'

const ANALYZE_LABEL = 'Analyze new imagery'

/**
 * 56px white bar. Full navigation from 900px; below that a menu button opens a sheet.
 * Hides text before it hides function: the product name and button label go first.
 */
export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="flex h-topbar items-center gap-3 px-4 xl:gap-5 xl:px-6">
        <Link
          to="/"
          aria-label={`${ENV.appName}, overview`}
          className="flex shrink-0 items-center gap-2.5 rounded-control"
        >
          <Logomark />
          <span className="hidden text-heading tracking-tight text-ink xs:inline nav:hidden xl:inline">
            {ENV.appName}
          </span>
        </Link>

        <PrimaryNav className="ml-2 hidden nav:block xl:ml-4" />

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="hidden min-w-0 nav:flex">
            <ObservationChip />
          </div>
          <ModeChip />
          <Tooltip content={ANALYZE_LABEL} align="end" side="bottom">
            <Link
              to="/analyze"
              aria-label={ANALYZE_LABEL}
              className={buttonStyles({
                variant: 'primary',
                size: 'sm',
                className: 'w-8 px-0 sm:w-auto sm:px-3 nav:w-8 nav:px-0 xl:w-auto xl:px-3',
              })}
            >
              <ScanSearch aria-hidden />
              <span className="hidden sm:inline nav:hidden xl:inline">{ANALYZE_LABEL}</span>
            </Link>
          </Tooltip>
          <IconButton
            label="Open menu"
            icon={<Menu aria-hidden />}
            size="sm"
            tooltip={false}
            className="nav:hidden"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          />
        </div>
      </div>
      <OfflineBanner />

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="flex flex-col gap-5">
          <SheetNav onNavigate={() => setMenuOpen(false)} />
          <Divider />
          <section aria-labelledby="sheet-observation" className="flex flex-col gap-2">
            <h3 id="sheet-observation" className="text-caption font-medium text-ink-muted">
              Current observation
            </h3>
            <ObservationChip fullWidth align="start" />
          </section>
        </div>
      </Drawer>
    </header>
  )
}
