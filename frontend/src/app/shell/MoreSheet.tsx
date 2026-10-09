import { Keyboard, Search, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Drawer, SectionLabel } from '@/components/ui'
import { ObservationChip } from '@/features/observations/components/ObservationChip'
import { useOpenCommandPalette } from './paletteContext'
import { useOpenShortcuts } from './shortcutsContext'

const ROW =
  'flex h-12 w-full items-center gap-3 border-b border-hairline text-body text-ink hover:text-accent-ink [&_svg]:size-4 [&_svg]:text-ink-2'

/** Phones: what the bottom tab bar has no room for. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const openPalette = useOpenCommandPalette()
  const openShortcuts = useOpenShortcuts()
  const then = (action: () => void) => () => {
    onClose()
    action()
  }
  return (
    <Drawer open={open} onClose={onClose} title="More">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="more-observation" className="flex flex-col gap-3">
          <SectionLabel id="more-observation" as="h3">
            Current observation
          </SectionLabel>
          <ObservationChip fullWidth align="start" />
        </section>
        <nav aria-label="More" className="flex flex-col border-t border-hairline">
          <Link to="/settings" onClick={onClose} className={ROW}>
            <Settings aria-hidden />
            Settings
          </Link>
          <button type="button" onClick={then(openPalette)} className={ROW}>
            <Search aria-hidden />
            Search pages, observations and actions
          </button>
          <button type="button" onClick={then(openShortcuts)} className={ROW}>
            <Keyboard aria-hidden />
            Keyboard shortcuts
          </button>
        </nav>
      </div>
    </Drawer>
  )
}
