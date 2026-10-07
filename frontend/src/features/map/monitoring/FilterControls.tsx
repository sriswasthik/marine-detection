import { CalendarDays } from 'lucide-react'
import { useId } from 'react'
import { buttonStyles, Button, Popover, SeveritySwatch } from '@/components/ui'
import { DENSITY_LEVEL_IDS, type DensityLevel } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatConfidence, formatDate } from '@/lib/format'

/** Minimum confidence as a compact inline slider with its live value. */
export function ConfidenceFilter({
  value,
  onChange,
  className,
}: {
  /** 0 to 1. */
  value: number
  onChange: (value: number) => void
  className?: string
}) {
  const id = useId()
  const percent = Math.round(value * 100)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="text-caption font-medium whitespace-nowrap text-ink-muted">
        Min. confidence
      </label>
      <span className="relative block h-5 w-24 shrink-0">
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${percent}%` }}
          />
        </span>
        <input
          id={id}
          type="range"
          className="range-input absolute inset-0"
          min={0}
          max={100}
          step={5}
          value={percent}
          aria-valuetext={formatConfidence(value)}
          onChange={(event) => onChange(Number(event.target.value) / 100)}
        />
      </span>
      <span className="num w-9 text-right text-caption text-ink">{formatConfidence(value)}</span>
    </div>
  )
}

/** Four toggle chips, one per density level, each with its swatch and label. */
export function DensityChips({
  value,
  onChange,
}: {
  value: readonly DensityLevel[]
  onChange: (levels: DensityLevel[]) => void
}) {
  const toggle = (level: DensityLevel) =>
    onChange(
      DENSITY_LEVEL_IDS.filter((l) => (l === level ? !value.includes(level) : value.includes(l))),
    )
  return (
    <div role="group" aria-label="Density level" className="flex flex-wrap items-center gap-1">
      {DENSITY_LEVEL_IDS.map((level) => {
        const on = value.includes(level)
        return (
          <button
            key={level}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(level)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-badge border px-2 text-caption font-medium transition-colors duration-150 ease-out',
              on
                ? 'border-border-strong bg-surface text-ink'
                : 'border-dashed border-border bg-bg text-ink-muted hover:text-ink',
            )}
          >
            <SeveritySwatch level={level} className={on ? '' : 'opacity-40'} />
            {DENSITY_LEVELS[level].label}
          </button>
        )
      })}
    </div>
  )
}

function DateFields({
  from,
  to,
  onChange,
}: {
  from: string | null
  to: string | null
  onChange: (range: { dateFrom: string | null; dateTo: string | null }) => void
}) {
  const fromId = useId()
  const toId = useId()
  const input =
    'h-8 rounded-control border border-border-strong bg-surface px-2 text-small text-ink shadow-subtle'
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={fromId} className="text-caption font-medium text-ink-muted">
          From
        </label>
        <input
          id={fromId}
          type="date"
          className={input}
          value={from ?? ''}
          max={to ?? undefined}
          onChange={(e) => onChange({ dateFrom: e.target.value || null, dateTo: to })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={toId} className="text-caption font-medium text-ink-muted">
          To
        </label>
        <input
          id={toId}
          type="date"
          className={input}
          value={to ?? ''}
          min={from ?? undefined}
          onChange={(e) => onChange({ dateFrom: from, dateTo: e.target.value || null })}
        />
      </div>
      {from || to ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange({ dateFrom: null, dateTo: null })}
        >
          Any date
        </Button>
      ) : null}
    </div>
  )
}

function rangeLabel(from: string | null, to: string | null): string {
  const date = (value: string) => formatDate(`${value}T00:00:00Z`, { timeZone: 'UTC' })
  if (from && to) return `${date(from)} to ${date(to)}`
  if (from) return `From ${date(from)}`
  if (to) return `Until ${date(to)}`
  return 'Any date'
}

/** Capture date range: a compact button with a popover, or inline fields in the stacked layout. */
export function DateRangeFilter({
  from,
  to,
  onChange,
  inline = false,
}: {
  from: string | null
  to: string | null
  onChange: (range: { dateFrom: string | null; dateTo: string | null }) => void
  inline?: boolean
}) {
  if (inline) return <DateFields from={from} to={to} onChange={onChange} />
  return (
    <Popover
      label="Capture date"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={buttonStyles({
            variant: 'secondary',
            size: 'sm',
            className: cn('font-normal', (from || to) && 'border-accent/40 text-accent'),
          })}
        >
          <CalendarDays aria-hidden />
          <span className="sr-only">Capture date: </span>
          {rangeLabel(from, to)}
        </button>
      )}
    >
      <DateFields from={from} to={to} onChange={onChange} />
    </Popover>
  )
}
