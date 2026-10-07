import { ChevronDown, Info } from 'lucide-react'
import { useId, useState } from 'react'
import { SeverityBadge, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence, formatInteger } from '@/lib/format'
import { PRIORITY_SCORE_EXPLANATION, type Hotspot } from '@/lib/hotspots'
import { useFormat } from '@/features/settings/settingsContext'

/** Rank in a small circle with the level colour as its border, like the map marker. */
export function RankDot({ hotspot }: { hotspot: Pick<Hotspot, 'rank' | 'level'> }) {
  return (
    <span
      aria-hidden
      className="num inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-surface text-caption font-semibold text-ink"
      style={{ borderColor: DENSITY_LEVELS[hotspot.level].stroke }}
    >
      {hotspot.rank}
    </span>
  )
}

export interface InspectionPriorityProps {
  hotspots: readonly Hotspot[]
  selectedId: string | null
  hasDetections: boolean
  onHighlight: (id: string | null) => void
  onSelect: (id: string) => void
  defaultOpen?: boolean
  className?: string
}

/** "Where to inspect next": hotspots ranked by priority score. */
export function InspectionPriority({
  hotspots,
  selectedId,
  hasDetections,
  onHighlight,
  onSelect,
  defaultOpen = true,
  className,
}: InspectionPriorityProps) {
  const fmt = useFormat()
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <section
      aria-label="Where to inspect next"
      className={cn(
        'w-80 max-w-full rounded-control border border-border bg-surface shadow-subtle',
        className,
      )}
    >
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-control px-3 text-small font-medium text-ink hover:bg-bg"
        >
          <span className="truncate">Where to inspect next</span>
          <span className="num rounded-badge bg-bg px-1.5 text-caption text-ink-muted">
            {formatInteger(hotspots.length)}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'ml-auto size-4 text-ink-muted transition-transform duration-150 ease-out',
              open && 'rotate-180',
            )}
          />
        </button>
        <Tooltip content={PRIORITY_SCORE_EXPLANATION} side="bottom" align="end">
          <button
            type="button"
            aria-label="How hotspots are ranked"
            className="inline-flex size-7 items-center justify-center rounded-control text-ink-muted hover:bg-bg hover:text-ink"
          >
            <Info aria-hidden className="size-4" />
          </button>
        </Tooltip>
      </div>

      <div id={bodyId} hidden={!open} className="border-t border-border">
        {hotspots.length === 0 ? (
          <p className="px-3 py-3 text-small text-ink-muted">
            {hasDetections
              ? 'No hotspots in view. The detections shown are scattered or low density.'
              : 'Nothing to inspect in the current view.'}
          </p>
        ) : (
          <ol className="max-h-[40dvh] overflow-y-auto p-1">
            {hotspots.map((hotspot) => (
              <li key={hotspot.id}>
                <button
                  type="button"
                  onClick={() => onSelect(hotspot.id)}
                  onPointerEnter={() => onHighlight(hotspot.id)}
                  onPointerLeave={() => onHighlight(null)}
                  onFocus={() => onHighlight(hotspot.id)}
                  onBlur={() => onHighlight(null)}
                  aria-current={hotspot.id === selectedId ? 'true' : undefined}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-control px-2 py-2 text-left transition-colors duration-150 ease-out',
                    hotspot.id === selectedId ? 'bg-accent-soft' : 'hover:bg-bg',
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <RankDot hotspot={hotspot} />
                    <span className="sr-only">Hotspot {hotspot.rank}, </span>
                    <SeverityBadge level={hotspot.level} />
                    <span className="num ml-auto text-small font-medium text-ink">
                      {fmt.area(hotspot.totalAreaM2)}
                    </span>
                  </span>
                  <span className="flex w-full items-center gap-2 pl-8 text-caption text-ink-muted">
                    <span className="num whitespace-nowrap">
                      {formatConfidence(hotspot.meanConfidence)} confidence
                    </span>
                    <span aria-hidden>·</span>
                    <span className="mono-label truncate">
                      {fmt.coordinates(hotspot.centroid, { digits: 4 })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
