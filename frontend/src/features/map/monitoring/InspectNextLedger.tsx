import { Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence } from '@/lib/format'
import type { Hotspot } from '@/lib/hotspots'
import { useFormat } from '@/features/settings/settingsContext'

/** Rank in a small square framed in the level's stroke colour: the list's echo of the map marker. */
export function RankDot({ hotspot }: { hotspot: Pick<Hotspot, 'rank' | 'level'> }) {
  return (
    <span
      aria-hidden
      className="data inline-flex size-6 shrink-0 items-center justify-center border-[1.5px] bg-white font-medium text-ink"
      style={{ borderColor: DENSITY_LEVELS[hotspot.level].stroke }}
    >
      {hotspot.rank}
    </span>
  )
}

/** Rank, level, area and confidence: minimum widths so no figure is ever cut off. */
const COLUMNS =
  'grid grid-cols-[1.75rem_minmax(5.5rem,1fr)_minmax(4.25rem,auto)_minmax(2.75rem,auto)] items-center gap-x-2'

export interface InspectNextLedgerProps {
  hotspots: readonly Hotspot[]
  selectedId: string | null
  /** Hovering or focusing a row emphasises its hotspot on the map. */
  onHighlight: (id: string | null) => void
  onSelect: (id: string) => void
  /** Shown when there are no hotspots. */
  emptyText: string
}

/**
 * "Inspect next": hotspots by priority as a compact ledger with 40px rows. Coordinates are in each
 * row's tooltip and in the drawer, so nothing in the row truncates. Row 1 is emphasised.
 */
export function InspectNextLedger({
  hotspots,
  selectedId,
  onHighlight,
  onSelect,
  emptyText,
}: InspectNextLedgerProps) {
  const fmt = useFormat()
  if (hotspots.length === 0) return <p className="py-3 text-small text-ink-2">{emptyText}</p>
  return (
    <div role="table" aria-label="Hotspots ranked by priority" className="flex flex-col">
      <div role="rowgroup">
        <div role="row" className={cn(COLUMNS, 'h-8 border-b border-rule')}>
          <span role="columnheader" className="label text-ink-2">
            #
          </span>
          <span role="columnheader" className="label text-ink-2">
            Level
          </span>
          <span role="columnheader" className="label text-right text-ink-2">
            Area
          </span>
          <span role="columnheader" className="label text-right text-ink-2">
            Conf.
          </span>
        </div>
      </div>
      <div role="rowgroup">
        {hotspots.map((hotspot) => {
          const meta = DENSITY_LEVELS[hotspot.level]
          const first = hotspot.rank === 1
          const selected = hotspot.id === selectedId
          return (
            <Tooltip
              key={hotspot.id}
              content={
                <span className="data">{fmt.coordinates(hotspot.centroid, { digits: 4 })}</span>
              }
              side="bottom"
              align="start"
              wrapperClassName="flex w-full"
            >
              <button
                type="button"
                role="row"
                aria-label={`Hotspot ${hotspot.rank}, ${meta.label}, ${fmt.area(hotspot.totalAreaM2)}, ${formatConfidence(hotspot.meanConfidence)} confidence`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(hotspot.id)}
                onPointerEnter={() => onHighlight(hotspot.id)}
                onPointerLeave={() => onHighlight(null)}
                onFocus={() => onHighlight(hotspot.id)}
                onBlur={() => onHighlight(null)}
                data-first={first || undefined}
                className={cn(
                  COLUMNS,
                  'h-10 w-full border-b border-hairline text-left text-small transition-colors duration-[120ms] ease-out',
                  selected
                    ? 'bg-accent-wash'
                    : first
                      ? 'bg-ink/[0.04] hover:bg-ink/[0.07]'
                      : 'hover:bg-ink/[0.04]',
                )}
              >
                <span role="cell" className="flex">
                  <span
                    className={cn(
                      'data inline-flex h-5 min-w-5 items-center justify-center px-1',
                      first ? 'bg-tar text-white' : 'border border-rule text-ink',
                    )}
                  >
                    {hotspot.rank}
                  </span>
                </span>
                <span
                  role="cell"
                  className={cn(
                    'flex items-center gap-2',
                    first ? 'font-medium text-ink' : 'text-ink',
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 border"
                    style={{ backgroundColor: meta.color, borderColor: meta.stroke }}
                  />
                  {meta.label}
                </span>
                <span role="cell" className="data text-right whitespace-nowrap text-ink">
                  {fmt.area(hotspot.totalAreaM2)}
                </span>
                <span role="cell" className="data text-right whitespace-nowrap text-ink-2">
                  {formatConfidence(hotspot.meanConfidence)}
                </span>
              </button>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
