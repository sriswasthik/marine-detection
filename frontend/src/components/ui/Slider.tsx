import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Field } from './Field'

interface SliderBase {
  label: ReactNode
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

function Track({ from, to, disabled }: { from: number; to: number; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border"
    >
      <span
        className={cn(
          'absolute inset-y-0 rounded-full',
          disabled ? 'bg-border-strong' : 'bg-accent',
        )}
        style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }}
      />
    </span>
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
  className,
  id,
}: SliderProps) {
  return (
    <Field label={label} hint={hint} aside={formatValue(value)} id={id} className={className}>
      {({ id: controlId, describedBy }) => (
        <span className="relative block h-5">
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
        <span className="relative block h-5" role="group" aria-labelledby={labelId}>
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
      )}
    </Field>
  )
}
