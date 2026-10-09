import { cn } from '@/lib/cn'
import { formatConfidence } from '@/lib/format'
import { CONFIDENCE_BAND_LABELS, confidenceBand, type ConfidenceBand } from '@/lib/stats'
import { BADGE_BASE } from './Badge'

const BAND_STYLES: Record<ConfidenceBand, { filled: number; bar: string; badge: string }> = {
  high: { filled: 3, bar: 'bg-accent', badge: 'border-border bg-surface' },
  medium: { filled: 2, bar: 'bg-ink-muted', badge: 'border-border bg-surface' },
  low: { filled: 1, bar: 'bg-warning', badge: 'border-transparent bg-warning-soft' },
}

const BAR_HEIGHTS = ['h-1.5', 'h-2.5', 'h-3.5'] as const

export function ConfidenceGlyph({ band, className }: { band: ConfidenceBand; className?: string }) {
  const style = BAND_STYLES[band]
  return (
    <span aria-hidden className={cn('inline-flex h-3.5 items-end gap-[2px]', className)}>
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className={cn(
            'w-[3px] rounded-[1px]',
            height,
            index < style.filled ? style.bar : 'bg-border-strong',
          )}
        />
      ))}
    </span>
  )
}

export interface ConfidenceBadgeProps {
  /** Model confidence, 0 to 1. Bands come from CONFIDENCE_THRESHOLDS in src/lib/config.ts. */
  value: number
  /** Show the percentage next to the band label. */
  showValue?: boolean
  className?: string
}

export function ConfidenceBadge({ value, showValue = true, className }: ConfidenceBadgeProps) {
  const band = confidenceBand(value)
  const label = CONFIDENCE_BAND_LABELS[band]
  const percent = formatConfidence(value)
  return (
    <span
      className={cn(BADGE_BASE, 'text-ink', BAND_STYLES[band].badge, className)}
      data-band={band}
    >
      <ConfidenceGlyph band={band} />
      <span>
        {label}
        <span className="sr-only"> confidence</span>
      </span>
      {showValue ? (
        <span className={cn('num font-normal', band === 'low' ? 'text-ink' : 'text-ink-muted')}>
          {percent}
        </span>
      ) : null}
    </span>
  )
}
