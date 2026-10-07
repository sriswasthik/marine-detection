import { SourceIcon } from '@/features/observations/components/SourceIcon'
import { SOURCE_LABELS } from '@/features/observations/labels'
import type { Observation } from '@/features/observations/types'
import { cn } from '@/lib/cn'

/** "Or try a sample scene": fills the form without a real file or the network. */
export function SampleScenes({
  scenes,
  selectedId,
  onSelect,
}: {
  scenes: readonly Observation[]
  selectedId: string | null
  onSelect: (observation: Observation) => void
}) {
  return (
    <section aria-labelledby="samples-title" className="flex flex-col gap-3">
      <div>
        <h2 id="samples-title" className="text-heading text-ink">
          Or try a sample scene
        </h2>
        <p className="text-small text-ink-muted">
          Synthetic sample data. Fills the form so you can run the full flow without a file.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {scenes.map((scene) => {
          const selected = scene.id === selectedId
          return (
            <li key={scene.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(scene)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-card border bg-surface px-4 py-3 text-left shadow-subtle',
                  'transition-colors duration-150 ease-out',
                  selected
                    ? 'border-accent ring-1 ring-accent'
                    : 'border-border hover:border-border-strong hover:bg-bg',
                )}
              >
                <SourceIcon
                  source={scene.source}
                  className="mt-0.5 size-4 shrink-0 text-ink-muted"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-small font-medium text-ink">
                    {scene.name ?? scene.region}
                  </span>
                  <span className="truncate text-caption text-ink-muted">{scene.region}</span>
                  <span className="text-caption text-ink-muted">{SOURCE_LABELS[scene.source]}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
