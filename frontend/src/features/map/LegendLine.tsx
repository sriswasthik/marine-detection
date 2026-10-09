import { Info } from 'lucide-react'
import { Popover } from '@/components/ui'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence, formatLength } from '@/lib/format'
import { MAP_COLORS } from '@/lib/map/basemaps'
import { footprintLabel, LOW_CONFIDENCE_DASH } from '@/lib/map/detectionStyle'
import { DensityLegend } from './DensityLegend'

export interface LegendLineProps {
  /** Grid cell edge in meters, from gridCellSizeForResolution. */
  cellSizeM: number
  /** True when the CRS is unknown and the footprint is approximate. */
  approximateFootprint: boolean
  /** The details popover, controlled so the "l" shortcut can open it. Closed by default. */
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
}

/**
 * The legend as one line, inset 16px at the map's bottom left: the four level swatches with their
 * names, and an info button whose popover gives the meanings, the low-confidence outline, the
 * footprint line and the grid cell size.
 */
export function LegendLine({
  cellSizeM,
  approximateFootprint,
  open,
  onOpenChange,
  className,
}: LegendLineProps) {
  return (
    <section
      aria-label="Map legend"
      data-chrome="overlay"
      className={cn(
        'absolute bottom-4 left-4 z-[500] flex h-8 max-w-[calc(100%-2rem)] items-center gap-3 border border-rule bg-sheet pr-1 pl-3 max-sm:h-10',
        className,
      )}
    >
      <ul className="flex min-w-0 items-center gap-3 text-small text-ink">
        {DENSITY_LEVEL_IDS.map((level) => (
          <li key={level} className="flex items-center gap-1 whitespace-nowrap">
            <span
              aria-hidden
              className="size-2 shrink-0 border"
              style={{
                backgroundColor: DENSITY_LEVELS[level].color,
                borderColor: DENSITY_LEVELS[level].stroke,
              }}
            />
            {DENSITY_LEVELS[level].label}
          </li>
        ))}
      </ul>
      <Popover
        label="Legend details"
        side="top"
        align="start"
        open={open}
        onOpenChange={onOpenChange}
        panelClassName="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-4"
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label="Legend details"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-ink/5 hover:text-ink max-sm:size-8 [&_svg]:size-4"
          >
            <Info aria-hidden />
          </button>
        )}
      >
        <div className="flex flex-col gap-2">
          <p className="label text-ink-2">Density level</p>
          <DensityLegend />
        </div>
        <ul className="flex flex-col gap-2 text-small text-ink">
          <li className="flex items-center gap-2">
            <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
              <rect
                x="0.75"
                y="0.75"
                width="10.5"
                height="10.5"
                fill="none"
                stroke="var(--color-ink-2)"
                strokeWidth="1.5"
                strokeDasharray={LOW_CONFIDENCE_DASH.replace(' ', ',')}
              />
            </svg>
            <span>
              Lower confidence{' '}
              <span className="text-ink-2">
                (under {formatConfidence(CONFIDENCE_THRESHOLDS.low)})
              </span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
              <line
                x1="0"
                y1="6"
                x2="12"
                y2="6"
                stroke={MAP_COLORS.muted}
                strokeWidth="1"
                strokeDasharray={approximateFootprint ? '1,3' : '4,2'}
              />
            </svg>
            <span>{footprintLabel(approximateFootprint)}</span>
          </li>
          <li className="flex items-center gap-2">
            <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
              <circle
                cx="6"
                cy="6"
                r="4.5"
                fill="none"
                stroke="var(--color-critical-stroke)"
                strokeWidth="1.5"
              />
            </svg>
            <span>Hotspot: the number ranks it by priority</span>
          </li>
        </ul>
        <p className="text-small text-ink-2">
          Density is measured on a grid of {formatLength(cellSizeM)} cells.
        </p>
      </Popover>
    </section>
  )
}
