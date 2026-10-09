import type { ComponentPropsWithRef, ReactNode } from 'react'
import type { DensityLevel } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence } from '@/lib/format'
import { CONFIDENCE_BAND_LABELS, confidenceBand, type ConfidenceBand } from '@/lib/stats'

export type TagTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

/** Static class names per tone so Tailwind can see them. */
const TONES: Record<TagTone, { tag: string; swatch: string }> = {
  neutral: { tag: 'border-hairline text-ink', swatch: 'bg-ink-2' },
  accent: { tag: 'border-transparent text-accent-ink', swatch: 'bg-accent-ink' },
  success: { tag: 'border-transparent text-ink', swatch: 'bg-success' },
  warning: { tag: 'border-warning/40 text-ink', swatch: 'bg-warning' },
  danger: { tag: 'border-transparent text-ink', swatch: 'bg-danger' },
}

/**
 * A label, not a chip: an 8px square swatch, then the text. No fill. Warnings (sample data, low
 * confidence) keep a hairline frame so they stay findable in a busy row.
 */
export const TAG_BASE =
  'inline-flex h-5 shrink-0 items-center gap-2 rounded-tag border text-small leading-none font-medium whitespace-nowrap'

export interface TagProps extends ComponentPropsWithRef<'span'> {
  tone?: TagTone
  /** The text is required: colour never carries the meaning alone. */
  children: ReactNode
  /** The square colour swatch before the text. On by default for every tone but neutral. */
  swatch?: boolean
  icon?: ReactNode
}

export function Tag({ tone = 'neutral', swatch, icon, className, children, ...rest }: TagProps) {
  const styles = TONES[tone]
  const showSwatch = swatch ?? tone !== 'neutral'
  return (
    <span
      className={cn(TAG_BASE, 'px-2 [&_svg]:size-3', styles.tag, className)}
      data-tone={tone}
      {...rest}
    >
      {showSwatch ? <span aria-hidden className={cn('size-2 shrink-0', styles.swatch)} /> : null}
      {icon}
      {children}
    </span>
  )
}

/** Static class names per level. Colours come from the tokens. */
const LEVEL_CLASSES: Record<DensityLevel, { swatch: string }> = {
  low: { swatch: 'bg-low border-low-stroke' },
  moderate: { swatch: 'bg-moderate border-moderate-stroke' },
  high: { swatch: 'bg-high border-high-stroke' },
  critical: { swatch: 'bg-critical border-critical-stroke' },
}

/** An 8px square of the level's fill with its stroke. Decorative: always next to the label. */
export function SeveritySwatch({ level, className }: { level: DensityLevel; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('size-2 shrink-0 border', LEVEL_CLASSES[level].swatch, className)}
    />
  )
}

export interface SeverityTagProps {
  level: DensityLevel
  /** `soft` sits on the level's tint; `plain` is swatch and text only, for ledgers and legends. */
  variant?: 'soft' | 'plain'
  /** Shows the one-line meaning after the label. */
  showMeaning?: boolean
  className?: string
}

/** Density level as a swatch plus its text label. Never colour alone. */
export function SeverityTag({
  level,
  variant = 'soft',
  showMeaning = false,
  className,
}: SeverityTagProps) {
  const meta = DENSITY_LEVELS[level]
  return (
    <span
      className={cn(
        TAG_BASE,
        'border-transparent text-ink',
        // On paper every tag is a swatch and a word: the soft tint is gone, `soft` keeps the inset.
        variant === 'soft' && 'px-2',
        className,
      )}
      data-level={level}
      title={showMeaning ? undefined : meta.meaning}
    >
      <SeveritySwatch level={level} />
      <span>{meta.label}</span>
      {showMeaning ? <span className="font-normal text-ink">· {meta.meaning}</span> : null}
    </span>
  )
}

const BAND_STYLES: Record<ConfidenceBand, { filled: number; bar: string; tag: string }> = {
  high: { filled: 3, bar: 'fill-ink', tag: 'border-hairline' },
  medium: { filled: 2, bar: 'fill-ink-2', tag: 'border-hairline' },
  low: { filled: 1, bar: 'fill-warning', tag: 'border-warning/40' },
}

const BAR_HEIGHTS = [4, 8, 12] as const

/** Three squared bars, filled by band: a glance-able confidence mark. */
export function ConfidenceGlyph({ band, className }: { band: ConfidenceBand; className?: string }) {
  const style = BAND_STYLES[band]
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      width={12}
      height={12}
      className={cn('shrink-0', className)}
    >
      {BAR_HEIGHTS.map((height, index) => (
        <rect
          key={height}
          x={index * 4.5}
          y={12 - height}
          width={3}
          height={height}
          className={index < style.filled ? style.bar : 'fill-rule'}
        />
      ))}
    </svg>
  )
}

export interface ConfidenceTagProps {
  /** Model confidence, 0 to 1. Bands come from CONFIDENCE_THRESHOLDS in src/lib/config.ts. */
  value: number
  /** Show the percentage next to the band label. */
  showValue?: boolean
  className?: string
}

/** Confidence band as bars plus its label, and the percentage in mono. */
export function ConfidenceTag({ value, showValue = true, className }: ConfidenceTagProps) {
  const band = confidenceBand(value)
  const label = CONFIDENCE_BAND_LABELS[band]
  return (
    <span
      className={cn(TAG_BASE, 'px-2 text-ink', BAND_STYLES[band].tag, className)}
      data-band={band}
    >
      <ConfidenceGlyph band={band} />
      <span>
        {label}
        <span className="sr-only"> confidence</span>
      </span>
      {showValue ? (
        <span className="font-mono text-mono font-normal text-ink-2">
          {formatConfidence(value)}
        </span>
      ) : null}
    </span>
  )
}
