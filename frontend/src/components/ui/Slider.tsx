import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './Field'

interface SliderBase {
  label: ReactNode
  /** Optional distribution drawn above the track, for example a SliderHistogram. */
  histogram?: ReactNode
  min: number
  max: number
  step?: number
  hint?: ReactNode
  disabled?: boolean
  /** Formats values for display and for screen readers. */
  formatValue?: (value: number) => string
  className?: string
  id?: string
}

export interface SliderProps extends SliderBase {
  value: number
  onChange: (value: number) => void
}

export interface RangeSliderProps extends SliderBase {
  value: readonly [number, number]
  onChange: (value: [number, number]) => void
  /** Smallest allowed gap between the two handles. Defaults to one step. */
  minGap?: number
}

const percentOf = (value: number, min: number, max: number) =>
  max === min ? 0 : ((value - min) / (max - min)) * 100

/** A hairline track; the chosen part is a 2px ink line. */
function Track({ from, to, disabled }: { from: number; to: number; disabled?: boolean }) {
  return (
    <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule">
      <span
        className={cn('absolute -top-px h-[3px]', disabled ? 'bg-rule' : 'bg-ink')}
        style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }}
      />
    </span>
  )
}

/**
 * Histogram slot for a slider: one squared bar per bin, the bins inside the chosen range in ink,
 * the rest in rule. Decorative; the slider's own value text carries the meaning.
 */
export function SliderHistogram({
  bins,
  range,
  className,
}: {
  /** Counts per bin, left to right across the slider's min to max. */
  bins: readonly number[]
  /** The chosen range as fractions of the track, 0 to 1. */
  range: readonly [number, number]
  className?: string
}) {
  const peak = Math.max(1, ...bins)
  const width = bins.length * 4
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} 32`}
      preserveAspectRatio="none"
      className={cn('block h-8 w-full', className)}
    >
      {bins.map((count, index) => {
        const centre = (index + 0.5) / bins.length
        const inside = centre >= range[0] && centre <= range[1]
        const height = Math.max(1, (count / peak) * 32)
        return (
          <rect
            key={index}
            x={index * 4}
            y={32 - height}
            width={3}
            height={height}
            className={inside ? 'fill-ink' : 'fill-rule'}
          />
        )
      })}
    </svg>
  )
}

/** Single value slider built on a native range input. */
export function Slider({
  label,
  min,
  max,
  step = 1,
  hint,
  disabled,
  formatValue = String,
  value,
  onChange,
  histogram,
  className,
  id,
}: SliderProps) {
  return (
    <Field label={label} hint={hint} aside={formatValue(value)} id={id} className={className}>
      {({ id: controlId, describedBy }) => (
        <span className="flex flex-col">
          {histogram}
          <span className="relative block h-5 pointer-coarse:h-10">
            <Track from={0} to={percentOf(value, min, max)} disabled={disabled} />
            <input
              id={controlId}
              type="range"
              className="range-input absolute inset-0"
              min={min}
              max={max}
              step={step}
              value={value}
              disabled={disabled}
              aria-describedby={describedBy}
              aria-valuetext={formatValue(value)}
              onChange={(event) => onChange(Number(event.target.value))}
            />
          </span>
        </span>
      )}
    </Field>
  )
}

/** Two-handle range slider: two native range inputs over one track. */
export function RangeSlider({
  label,
  min,
  max,
  step = 1,
  hint,
  disabled,
  formatValue = String,
  value,
  onChange,
  minGap = step,
  histogram,
  className,
  id,
}: RangeSliderProps) {
  const [low, high] = value
  const midpoint = (min + max) / 2
  return (
    <Field
      label={label}
      hint={hint}
      aside={`${formatValue(low)} to ${formatValue(high)}`}
      id={id}
      className={className}
    >
      {({ id: controlId, labelId, describedBy }) => (
        <span className="flex flex-col">
          {histogram}
          <span
            className="relative block h-5 pointer-coarse:h-10"
            role="group"
            aria-labelledby={labelId}
          >
            <Track
              from={percentOf(low, min, max)}
              to={percentOf(high, min, max)}
              disabled={disabled}
            />
            <input
              id={controlId}
              type="range"
              aria-label="Minimum"
              className={cn('range-input absolute inset-0', low > midpoint ? 'z-20' : 'z-10')}
              min={min}
              max={max}
              step={step}
              value={low}
              disabled={disabled}
              aria-describedby={describedBy}
              aria-valuetext={formatValue(low)}
              onChange={(event) =>
                onChange([Math.min(Number(event.target.value), high - minGap), high])
              }
            />
            <input
              type="range"
              aria-label="Maximum"
              className={cn('range-input absolute inset-0', low > midpoint ? 'z-10' : 'z-20')}
              min={min}
              max={max}
              step={step}
              value={high}
              disabled={disabled}
              aria-describedby={describedBy}
              aria-valuetext={formatValue(high)}
              onChange={(event) =>
                onChange([low, Math.max(Number(event.target.value), low + minGap)])
              }
            />
          </span>
        </span>
      )}
    </Field>
  )
}
