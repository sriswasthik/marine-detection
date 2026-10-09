import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import { formatConfidence, formatLength } from '@/lib/format'
import { MAP_COLORS } from '@/lib/map/basemaps'
import { footprintLabel, LOW_CONFIDENCE_DASH } from '@/lib/map/detectionStyle'
import { DensityLegend } from './DensityLegend'

export interface MapLegendProps {
  /** Grid cell edge in meters, from gridCellSizeForResolution. */
  cellSizeM: number
  /** True when the CRS is unknown and the footprint is approximate. */
  approximateFootprint: boolean
  className?: string
}

/**
 * Bottom-left legend: density levels, the low-confidence outline, the footprint line and the
 * grid cell size. Open by default; on narrow screens it starts collapsed to keep the map visible.
 */
export function MapLegend({ cellSizeM, approximateFootprint, className }: MapLegendProps) {
  const isWide = useMediaQuery('(min-width: 640px)')
  const [openOverride, setOpenOverride] = useState<boolean | null>(null)
  const open = openOverride ?? isWide
  const bodyId = useId()

  return (
    <section
      aria-label="Map legend"
      className={cn(
        'w-[min(18rem,calc(100vw-2rem))] rounded-control border border-border bg-surface shadow-subtle',
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpenOverride(!open)}
        className="flex h-8 w-full items-center gap-2 rounded-control px-3 text-small font-medium text-ink hover:bg-bg"
      >
        <span className="flex-1 text-left">Legend</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 text-ink-muted transition-transform duration-150 ease-out',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        id={bodyId}
        hidden={!open}
        className="flex flex-col gap-3 border-t border-border px-3 py-3"
      >
        <div className="flex flex-col gap-1.5">
          <p className="text-caption font-medium text-ink-muted">Density level</p>
          <DensityLegend />
        </div>
        <ul className="flex flex-col gap-1.5 text-caption text-ink">
          <li className="flex items-center gap-2">
            <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
              <rect
                x="0.75"
                y="0.75"
                width="10.5"
                height="10.5"
                rx="2"
                fill="none"
                stroke="var(--color-ink-muted)"
                strokeWidth="1.5"
                strokeDasharray={LOW_CONFIDENCE_DASH.replace(' ', ',')}
              />
            </svg>
            <span>
              Lower confidence{' '}
              <span className="text-ink-muted">
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
                stroke={MAP_COLORS.accent}
                strokeWidth="1.5"
                strokeDasharray={approximateFootprint ? '1,3' : '4,2'}
              />
            </svg>
            <span>{footprintLabel(approximateFootprint)}</span>
          </li>
        </ul>
        <p className="text-caption text-ink-muted">
          Density is measured on a grid of {formatLength(cellSizeM)} cells.
        </p>
      </div>
    </section>
  )
}
