import { Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button, SegmentedControl, SeveritySwatch } from '@/components/ui'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import {
  DENSITY_FILTERS,
  isFiltered,
  type DensityFilter,
  type ListQuery,
} from '@/lib/observationList'
import { SOURCE_LABELS, STATUS_LABELS } from '../labels'
import { OBSERVATION_STATUSES, type ObservationStatus } from '../types'

const SOURCE_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'satellite' as const, label: SOURCE_LABELS.satellite },
  { value: 'drone' as const, label: SOURCE_LABELS.drone },
]

/** A small on/off chip. Off chips are dashed; none selected means "all". */
function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-badge border px-2 text-caption font-medium transition-colors duration-150 ease-out',
        on
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-dashed border-border bg-surface text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function toggle<T>(list: readonly T[], value: T, order: readonly T[]): T[] {
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  return order.filter((item) => next.includes(item))
}

/** Search, source, status and density filters for the observations table. */
export function ObservationFilters({
  query,
  onChange,
  onReset,
}: {
  query: ListQuery
  onChange: (patch: Partial<ListQuery>, options?: { replace?: boolean }) => void
  onReset: () => void
}) {
  // Local text so typing stays smooth; the URL follows a moment later.
  const [text, setText] = useState(query.search)
  const [synced, setSynced] = useState(query.search)
  if (query.search !== synced) {
    // The URL changed from elsewhere (Back, Reset): show its search.
    setSynced(query.search)
    setText(query.search)
  }
  useEffect(() => {
    if (text === query.search) return
    const timer = window.setTimeout(() => onChange({ search: text }, { replace: true }), 250)
    return () => window.clearTimeout(timer)
  }, [text, query.search, onChange])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-0 flex-1 basis-64">
          <span className="sr-only">Search by region</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search by region"
            className="h-8 w-full rounded-control border border-border-strong bg-surface pr-8 pl-8 text-small text-ink shadow-subtle placeholder:text-ink-muted"
          />
          {text ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setText('')
                onChange({ search: '' }, { replace: true })
              }}
              className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-control text-ink-muted hover:text-ink"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </label>
        <SegmentedControl
          label="Source"
          size="sm"
          options={SOURCE_OPTIONS}
          value={query.source}
          onChange={(source) => onChange({ source })}
        />
        {isFiltered(query) ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset filters
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-caption text-ink-muted">Status</span>
          {OBSERVATION_STATUSES.map((status: ObservationStatus) => (
            <Chip
              key={status}
              on={query.statuses.includes(status)}
              onClick={() =>
                onChange({ statuses: toggle(query.statuses, status, OBSERVATION_STATUSES) })
              }
            >
              {STATUS_LABELS[status]}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Density level" className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-caption text-ink-muted">Density</span>
          {DENSITY_FILTERS.map((level: DensityFilter) => (
            <Chip
              key={level}
              on={query.levels.includes(level)}
              onClick={() => onChange({ levels: toggle(query.levels, level, DENSITY_FILTERS) })}
            >
              {level === 'none' ? null : <SeveritySwatch level={level} />}
              {level === 'none' ? 'No debris' : DENSITY_LEVELS[level].label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
