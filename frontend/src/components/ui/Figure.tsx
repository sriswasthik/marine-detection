import { cn } from '@/lib/cn'
import { useCountUp } from './useCountUp'

export type FigureSize = 'figure' | 'page' | 'title'

/** The figure's type token, and its unit at about 40% of it. */
const SIZES: Record<FigureSize, { figure: string; unit: string }> = {
  figure: { figure: 'text-figure', unit: 'text-title font-normal' },
  page: { figure: 'text-page', unit: 'text-small' },
  title: { figure: 'text-title', unit: 'text-small' },
}

/** Thin space between a figure and its unit. */
export const THIN_SPACE = ' '

export interface FigureProps {
  /** The number. Null shows a dash: nothing to measure. */
  value: number | null
  /** Formats the number; use a src/lib/format function so figures read the same everywhere. */
  format?: (value: number) => string
  unit?: string
  size?: FigureSize
  /**
   * Counts up from 0 once per session for this key (for example the observation id and the
   * measure). Off under reduced motion.
   */
  countUpKey?: string
  className?: string
}

const defaultFormat = (value: number) => String(Math.round(value))

/**
 * A headline figure: tabular numerals, the unit smaller and baseline-aligned after a thin space,
 * in ink-2. While counting up, assistive tech gets the final value only.
 */
export function Figure({
  value,
  format = defaultFormat,
  unit,
  size = 'figure',
  countUpKey,
  className,
}: FigureProps) {
  const { value: shown, running } = useCountUp(
    value ?? 0,
    value === null ? null : (countUpKey ?? null),
  )
  const styles = SIZES[size]
  const text = value === null ? '–' : format(value)
  return (
    <span className={cn('inline-flex items-baseline whitespace-nowrap', className)}>
      {running ? (
        <>
          <span aria-hidden className={cn('num text-ink', styles.figure)}>
            {format(shown)}
          </span>
          <span className="sr-only">{text}</span>
        </>
      ) : (
        <span className={cn('num text-ink', styles.figure)}>{text}</span>
      )}
      {unit && value !== null ? (
        <span className={cn('text-ink-2', styles.unit)}>
          {THIN_SPACE}
          {unit}
        </span>
      ) : null}
    </span>
  )
}
