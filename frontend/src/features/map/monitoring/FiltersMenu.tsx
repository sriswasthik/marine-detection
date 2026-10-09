import { Keyboard, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, Popover, SegmentedControl, Select } from '@/components/ui'
import { useOpenShortcuts } from '@/app/shell/shortcutsContext'
import type { ObservationSummary } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { activeFilterCount, regionGroups, type MapFilters, type SourceFilter } from '@/lib/filters'
import { DateRangeFilter } from './FilterControls'
import { ConfidenceControl, DensityToggles } from './ToolbarControls'
import { TOOLBAR_BUTTON } from './toolbarStyles'

const SOURCE_OPTIONS: readonly { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'drone', label: 'Drone' },
]

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="label text-ink-2">{label}</p>
      {children}
    </div>
  )
}

export interface FiltersMenuProps {
  observations: readonly ObservationSummary[]
  filters: MapFilters
  baseline: MapFilters
  onFiltersChange: (patch: Partial<MapFilters>, options?: { replace?: boolean }) => void
  onReset: () => void
  /**
   * `more`: date, source and region (the toolbar shows confidence and density itself).
   * `all`: every filter, for narrow toolbars.
   */
  scope: 'more' | 'all'
  /** Extra content at the end, for example Export on phones. */
  footer?: ReactNode
  /** Show only the icon on the trigger (phones). */
  compact?: boolean
}

/**
 * The toolbar's filter menu: the capture date, source and region (which choose observations, so
 * they stay out of the main row), Reset, and the keyboard shortcuts.
 */
export function FiltersMenu({
  observations,
  filters,
  baseline,
  onFiltersChange,
  onReset,
  scope,
  footer,
  compact = false,
}: FiltersMenuProps) {
  const openShortcuts = useOpenShortcuts()
  const count = activeFilterCount(filters, baseline)
  const regions = regionGroups(observations)
  const label = scope === 'all' ? 'Filters' : 'More filters'

  return (
    <Popover
      label={label}
      align="end"
      panelClassName="flex max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] flex-col gap-6 overflow-y-auto"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          data-toolbar-control=""
          aria-label={compact ? `${label}${count ? `, ${count} active` : ''}` : undefined}
          className={cn(TOOLBAR_BUTTON, compact && 'w-10 justify-center px-0')}
        >
          <SlidersHorizontal aria-hidden />
          {compact ? null : <span>{label}</span>}
          {count > 0 ? (
            <span className="data bg-accent-wash px-1 text-accent-ink">
              {count}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </button>
      )}
    >
      {scope === 'all' ? (
        <>
          <Group label="Minimum confidence">
            <ConfidenceControl
              value={filters.minConfidence}
              onChange={(minConfidence) => onFiltersChange({ minConfidence }, { replace: true })}
              className="self-start"
            />
          </Group>
          <Group label="Density">
            <DensityToggles
              value={filters.levels}
              onChange={(levels) => onFiltersChange({ levels })}
              className="self-start"
            />
          </Group>
        </>
      ) : null}
      <Group label="Capture date">
        <DateRangeFilter
          inline
          from={filters.dateFrom}
          to={filters.dateTo}
          onChange={(range) => onFiltersChange(range)}
        />
      </Group>
      <Group label="Source">
        <SegmentedControl
          label="Source"
          size="sm"
          options={SOURCE_OPTIONS}
          value={filters.source}
          onChange={(source) => onFiltersChange({ source })}
          className="self-start"
        />
      </Group>
      <Select
        label="Region"
        size="sm"
        value={filters.region ?? ''}
        onChange={(e) => onFiltersChange({ region: e.target.value || null })}
        options={[
          { value: '', label: 'All regions' },
          ...regions.map((r) => ({ value: r, label: r })),
        ]}
      />
      {count > 0 ? (
        <Button
          size="sm"
          variant="tertiary"
          iconEnd={null}
          onClick={onReset}
          className="self-start"
        >
          Reset filters
        </Button>
      ) : null}
      {footer}
      <div className="border-t border-hairline pt-3">
        <Button
          size="sm"
          variant="tertiary"
          iconStart={<Keyboard aria-hidden />}
          iconEnd={null}
          onClick={openShortcuts}
        >
          Keyboard shortcuts
        </Button>
      </div>
    </Popover>
  )
}
