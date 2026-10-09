import type { DensityLevel } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { BADGE_BASE } from './Badge'

/** Static class names per level so Tailwind can see them. Colours come from the tokens. */
const LEVEL_CLASSES: Record<DensityLevel, { soft: string; swatch: string }> = {
  low: { soft: 'bg-low-soft', swatch: 'bg-low border-low-stroke' },
  moderate: { soft: 'bg-moderate-soft', swatch: 'bg-moderate border-moderate-stroke' },
  high: { soft: 'bg-high-soft', swatch: 'bg-high border-high-stroke' },
  critical: { soft: 'bg-critical-soft', swatch: 'bg-critical border-critical-stroke' },
}

export interface SeverityBadgeProps {
  level: DensityLevel
  /** `soft` sits on a tinted background; `plain` is swatch and text only, for tables and legends. */
  variant?: 'soft' | 'plain'
  /** Shows the one-line meaning after the label. */
  showMeaning?: boolean
  className?: string
}

export function SeveritySwatch({ level, className }: { level: DensityLevel; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2.5 shrink-0 rounded-[3px] border',
        LEVEL_CLASSES[level].swatch,
        className,
      )}
    />
  )
}

/** Density level as a colour swatch plus a text label. Never colour alone. */
export function SeverityBadge({
  level,
  variant = 'soft',
  showMeaning = false,
  className,
}: SeverityBadgeProps) {
  const meta = DENSITY_LEVELS[level]
  return (
    <span
      className={cn(
        BADGE_BASE,
        'text-ink',
        variant === 'soft'
          ? cn('border-transparent', LEVEL_CLASSES[level].soft)
          : 'border-transparent px-0',
        className,
      )}
      title={showMeaning ? undefined : meta.meaning}
    >
      <SeveritySwatch level={level} />
      <span>{meta.label}</span>
      {showMeaning ? <span className="font-normal text-ink">· {meta.meaning}</span> : null}
    </span>
  )
}
