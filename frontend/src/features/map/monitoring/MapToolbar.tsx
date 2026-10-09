import { PanelLeft } from 'lucide-react'
import { Button, Tooltip } from '@/components/ui'
import type { ExportSource } from '@/features/export/exportFiles'
import { ExportMenu } from '@/features/export/ExportMenu'
import { isMockMode } from '@/features/observations/api'
import { ProvenanceTag } from '@/features/observations/components/ProvenanceTag'
import type { Observation, ObservationSummary } from '@/features/observations/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { MapFilters } from '@/lib/filters'
import { FiltersMenu } from './FiltersMenu'
import { ConfidenceControl, DensityToggles, ObservationSelect } from './ToolbarControls'
import { TOOLBAR_BUTTON } from './toolbarStyles'

export interface MapToolbarProps {
  observations: readonly ObservationSummary[]
  observation: Observation
  onObservationChange: (id: string) => void
  filters: MapFilters
  baseline: MapFilters
  onFiltersChange: (patch: Partial<MapFilters>, options?: { replace?: boolean }) => void
  onReset: () => void
  /** "61 detections · 3 hotspots". */
  status: string
  /** False when the observation itself is outside the date, source or region filters. */
  matches: boolean
  exportSource: ExportSource
  /** Under 1100px the side panel is a slide-over opened from here. */
  panel: { open: boolean; onToggle: () => void } | null
}

/**
 * One 48px row docked above the map, every control 32px with the same frame:
 *  - from 1280px: observation | min confidence | density | More filters | status, provenance | Export
 *  - 768 to 1279px: confidence and density move into Filters
 *  - under 768px: observation, the provenance tag and one Filters button (Export inside it)
 */
export function MapToolbar({
  observations,
  observation,
  onObservationChange,
  filters,
  baseline,
  onFiltersChange,
  onReset,
  status,
  matches,
  exportSource,
  panel,
}: MapToolbarProps) {
  const wide = useMediaQuery('(min-width: 1280px)')
  const phone = !useMediaQuery('(min-width: 768px)')
  const exportMenu = <ExportMenu source={exportSource} align="end" appearance="toolbar" />

  return (
    <div
      data-chrome="toolbar"
      className="flex h-12 min-w-0 items-center gap-2 border-b border-hairline bg-sheet px-3"
    >
      {panel ? (
        <Tooltip content="Inspect next and layers" side="bottom" align="start">
          <button
            type="button"
            data-toolbar-control=""
            aria-label="Inspect next and layers"
            aria-expanded={panel.open}
            onClick={panel.onToggle}
            className={`${TOOLBAR_BUTTON} w-8 justify-center px-0 max-sm:w-10`}
          >
            <PanelLeft aria-hidden />
          </button>
        </Tooltip>
      ) : null}
      <ObservationSelect
        observations={observations}
        observationId={observation.id}
        filters={filters}
        onChange={onObservationChange}
        className="w-60 min-w-0 shrink max-sm:flex-1"
      />
      {wide ? (
        <>
          <ConfidenceControl
            value={filters.minConfidence}
            onChange={(minConfidence) => onFiltersChange({ minConfidence }, { replace: true })}
          />
          <DensityToggles
            value={filters.levels}
            onChange={(levels) => onFiltersChange({ levels })}
          />
        </>
      ) : null}
      {phone ? null : (
        <FiltersMenu
          observations={observations}
          filters={filters}
          baseline={baseline}
          onFiltersChange={onFiltersChange}
          onReset={onReset}
          scope={wide ? 'more' : 'all'}
        />
      )}

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
        {phone ? null : (
          <p role="status" aria-live="polite" className="data whitespace-nowrap text-ink-2">
            {status}
            {matches ? null : (
              <span className="sr-only">. This observation is outside the filters.</span>
            )}
          </p>
        )}
        {matches || phone ? null : (
          <Button size="sm" variant="tertiary" iconEnd={null} onClick={onReset}>
            Outside filters: reset
          </Button>
        )}
        <ProvenanceTag observation={observation} mockMode={isMockMode()} quiet />
        {phone ? (
          <FiltersMenu
            observations={observations}
            filters={filters}
            baseline={baseline}
            onFiltersChange={onFiltersChange}
            onReset={onReset}
            scope="all"
            compact
            footer={<div className="self-start">{exportMenu}</div>}
          />
        ) : (
          exportMenu
        )}
      </div>
    </div>
  )
}
