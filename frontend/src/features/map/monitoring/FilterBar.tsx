import { SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { Button, buttonStyles, Popover, SegmentedControl, Select } from '@/components/ui'
import { SOURCE_LABELS } from '@/features/observations/labels'
import type { ObservationSummary } from '@/features/observations/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import {
  activeFilterCount,
  filterObservations,
  regionGroup,
  regionGroups,
  type MapFilters,
  type SourceFilter,
} from '@/lib/filters'
import { formatDate } from '@/lib/format'
import { ConfidenceFilter, DateRangeFilter, DensityChips } from './FilterControls'

export interface FilterBarProps {
  observations: readonly ObservationSummary[]
  observationId: string
  onObservationChange: (id: string) => void
  filters: MapFilters
  /** `replace` is set for continuous changes (the slider) so history is not flooded. */
  onFiltersChange: (patch: Partial<MapFilters>, options?: { replace?: boolean }) => void
  onReset: () => void
}

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'satellite', label: SOURCE_LABELS.satellite },
  { value: 'drone', label: SOURCE_LABELS.drone },
]

function Controls({ layout, ...props }: FilterBarProps & { layout: 'row' | 'stack' }) {
  const { observations, observationId, onObservationChange, filters, onFiltersChange, onReset } =
    props
  const stacked = layout === 'stack'

  const observationGroups = useMemo(() => {
    const visible = filterObservations(observations, filters)
    const current = observations.find((o) => o.id === observationId)
    const list = current && !visible.includes(current) ? [current, ...visible] : visible
    return regionGroups(list).map((group) => ({
      label: group,
      options: list
        .filter((o) => regionGroup(o.region) === group)
        .map((o) => ({ value: o.id, label: `${o.name ?? o.region}, ${formatDate(o.capturedAt)}` })),
    }))
  }, [observations, observationId, filters])

  const regions = useMemo(() => regionGroups(observations), [observations])
  const active = activeFilterCount(filters) > 0

  return (
    <div
      className={cn(
        stacked
          ? 'flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3'
          : 'flex flex-wrap items-center gap-2',
      )}
    >
      <Select
        label="Observation"
        hideLabel={!stacked}
        size="sm"
        value={observationId}
        onChange={(e) => onObservationChange(e.target.value)}
        groups={observationGroups}
        className={stacked ? undefined : 'w-52'}
      />
      <div className={cn(stacked && 'flex flex-col gap-1.5')}>
        {stacked ? <span className="text-small font-medium text-ink">Source</span> : null}
        <SegmentedControl
          label="Source"
          size="sm"
          value={filters.source}
          onChange={(source) => onFiltersChange({ source })}
          options={SOURCE_OPTIONS}
          className={stacked ? undefined : 'bg-bg'}
        />
      </div>
      <DateRangeFilter
        inline={stacked}
        from={filters.dateFrom}
        to={filters.dateTo}
        onChange={(range) => onFiltersChange(range)}
      />
      <ConfidenceFilter
        value={filters.minConfidence}
        onChange={(minConfidence) => onFiltersChange({ minConfidence }, { replace: true })}
      />
      <DensityChips value={filters.levels} onChange={(levels) => onFiltersChange({ levels })} />
      <Select
        label="Region"
        hideLabel={!stacked}
        size="sm"
        value={filters.region ?? ''}
        onChange={(e) => onFiltersChange({ region: e.target.value || null })}
        options={[
          { value: '', label: 'All regions' },
          ...regions.map((r) => ({ value: r, label: r })),
        ]}
        className={stacked ? undefined : 'w-36'}
      />
      {active ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onReset}
          className={stacked ? 'self-start' : undefined}
        >
          Reset
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Map filters in one compact row from 1100px. Narrower screens get a "Filters" button that
 * opens the same controls stacked in a popover.
 */
export function FilterBar(props: FilterBarProps) {
  const wide = useMediaQuery('(min-width: 1100px)')
  const count = activeFilterCount(props.filters)

  if (wide) {
    return (
      <div className="rounded-control border border-border bg-surface p-1.5 shadow-subtle">
        <Controls {...props} layout="row" />
      </div>
    )
  }
  return (
    <Popover
      label="Filters"
      panelClassName="max-h-[70dvh] overflow-y-auto"
      trigger={(triggerProps) => (
        <button
          type="button"
          {...triggerProps}
          className={buttonStyles({ variant: 'secondary', size: 'sm' })}
        >
          <SlidersHorizontal aria-hidden />
          Filters
          {count > 0 ? (
            <span className="num rounded-badge bg-accent-soft px-1.5 text-caption text-accent">
              {count}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </button>
      )}
    >
      <Controls {...props} layout="stack" />
    </Popover>
  )
}
