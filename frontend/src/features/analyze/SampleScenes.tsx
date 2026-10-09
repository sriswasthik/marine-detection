import { SourceIcon } from '@/features/observations/components/SourceIcon'
import { SOURCE_LABELS } from '@/features/observations/labels'
import type { Observation } from '@/features/observations/types'
import { cn } from '@/lib/cn'

/** "Or try a sample scene": a ruled list; picking a row fills the form without a real file. */
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
        <h2 id="samples-title" className="text-lead font-medium text-ink">
          Or try a sample scene
        </h2>
        <p className="text-small text-ink-2">
          Synthetic sample data. Fills the form so you can run the full flow without a file.
        </p>
      </div>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {scenes.map((scene) => {
          const selected = scene.id === selectedId
          return (
            <li key={scene.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(scene)}
                className={cn(
                  'flex w-full items-center gap-4 border-l-2 py-3 pr-2 pl-4 text-left',
                  'transition-colors duration-[120ms] ease-out',
                  selected ? 'border-ink bg-sheet' : 'border-transparent hover:bg-sheet',
                )}
              >
                <SourceIcon source={scene.source} className="size-4 shrink-0 text-ink-2" />
                <span className="w-48 shrink-0 truncate text-small font-medium text-ink">
                  {scene.name ?? scene.region}
                </span>
                <span className="min-w-0 flex-1 truncate text-small text-ink-2">
                  {scene.region}
                </span>
                <span className="text-small text-ink-2 max-sm:hidden">
                  {SOURCE_LABELS[scene.source]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
