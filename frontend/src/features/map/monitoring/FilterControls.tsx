import { CalendarDays } from 'lucide-react'
import { useId } from 'react'
import { buttonStyles, Button, Popover } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

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
    'data h-8 border-0 border-b border-rule bg-transparent px-0 text-ink hover:border-ink max-sm:h-10'
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={fromId} className="text-small font-medium text-ink-2">
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
        <label htmlFor={toId} className="text-small font-medium text-ink-2">
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
          variant="tertiary"
          iconEnd={null}
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
            className: cn('font-normal', (from || to) && 'border-accent-ink/40 text-accent-ink'),
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
