import { SeveritySwatch } from '@/components/ui'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'

/** The four density levels with swatch, label and one-line meaning. Reusable outside the map. */
export function DensityLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {[...DENSITY_LEVEL_IDS].reverse().map((level) => (
        <li key={level} className="flex items-center gap-2 text-caption">
          <SeveritySwatch level={level} className="size-3" />
          <span className="w-16 shrink-0 font-medium text-ink">{DENSITY_LEVELS[level].label}</span>
          <span className="text-ink-muted">{DENSITY_LEVELS[level].meaning}</span>
        </li>
      ))}
    </ul>
  )
}
