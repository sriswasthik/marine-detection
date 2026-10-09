import { Dialog, Kbd } from '@/components/ui'
import { SHORTCUT_GROUPS } from '@/lib/shortcuts'

/** The "?" dialog: every keyboard shortcut, from the same list the handlers use. */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Shortcuts work when no text field has focus."
    >
      <div className="flex flex-col gap-5">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} aria-labelledby={`shortcuts-${group.title}`}>
            <h3
              id={`shortcuts-${group.title}`}
              className="mb-2 text-small font-semibold tracking-wide text-ink-2 uppercase"
            >
              {group.title}
            </h3>
            <dl className="flex flex-col divide-y divide-hairline">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.description} className="flex items-center gap-4 py-2">
                  <dt className="flex min-w-24 shrink-0 gap-1">
                    {shortcut.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </dt>
                  <dd className="text-small text-ink">{shortcut.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
