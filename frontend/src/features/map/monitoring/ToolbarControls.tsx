import { ChevronDown } from 'lucide-react'
import { useId, useMemo } from 'react'
import { DropdownMenu, Tooltip, type DropdownMenuEntry } from '@/components/ui'
import { ObservationGlyphById } from '@/features/observations/components/ObservationGlyphById'
import {
  DENSITY_LEVEL_IDS,
  type DensityLevel,
  type ObservationSummary,
} from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { filterObservations, regionGroup, regionGroups, type MapFilters } from '@/lib/filters'
import { formatConfidence, formatDate } from '@/lib/format'
import { TOOLBAR_BUTTON, TOOLBAR_CONTROL } from './toolbarStyles'

/**
 * The observation in view, as a menu grouped by region: glyph, region and date. Observations the
 * date, source or region filters leave out are not offered (the current one always is).
 */
export function ObservationSelect({
  observations,
  observationId,
  filters,
  onChange,
  className,
}: {
  observations: readonly ObservationSummary[]
  observationId: string
  filters: MapFilters
  onChange: (id: string) => void
  className?: string
}) {
  const current = observations.find((o) => o.id === observationId)
  const items = useMemo<DropdownMenuEntry[]>(() => {
    const visible = filterObservations(observations, filters)
    const list = current && !visible.includes(current) ? [current, ...visible] : visible
    return regionGroups(list).flatMap((group): DropdownMenuEntry[] => [
      { type: 'label', id: `group-${group}`, label: group },
      ...list
        .filter((o) => regionGroup(o.region) === group)
        .map((o): DropdownMenuEntry => ({
          id: o.id,
          label: o.name ?? o.region,
          description: formatDate(o.capturedAt),
          icon: <ObservationGlyphById id={o.id} size={16} />,
          checked: o.id === observationId,
          onSelect: () => onChange(o.id),
        })),
    ])
  }, [observations, filters, current, observationId, onChange])

  return (
    <DropdownMenu
      items={items}
      className={className}
      menuClassName="w-80 max-w-[calc(100vw-2rem)]"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          data-toolbar-control=""
          className={cn(TOOLBAR_BUTTON, 'w-full min-w-0 justify-start px-2')}
        >
          <ObservationGlyphById id={observationId} size={16} />
          <span className="sr-only">Observation: </span>
          <span className="min-w-0 truncate font-medium">
            {current ? (current.name ?? current.region) : 'Observation'}
          </span>
          {current ? (
            <span className="data shrink-0 text-ink-2 max-sm:hidden">
              {formatDate(current.capturedAt)}
            </span>
          ) : null}
          <ChevronDown aria-hidden className="ml-auto text-ink-2" />
        </button>
      )}
    />
  )
}

/** Minimum confidence: a 120px hairline slider with a small square thumb and its value in mono. */
export function ConfidenceControl({
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
    <div data-toolbar-control="" className={cn(TOOLBAR_CONTROL, 'gap-2 px-2', className)}>
      <label htmlFor={id} className="label whitespace-nowrap text-ink-2">
        Min conf.
      </label>
      <span className="relative block h-5 w-[120px] shrink-0">
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule">
          <span
            className="absolute -top-px left-0 h-[3px] bg-ink"
            style={{ width: `${percent}%` }}
          />
        </span>
        <input
          id={id}
          type="range"
          aria-label="Minimum confidence"
          className="range-input absolute inset-0"
          min={0}
          max={100}
          step={5}
          value={percent}
          aria-valuetext={formatConfidence(value)}
          onChange={(event) => onChange(Number(event.target.value) / 100)}
        />
      </span>
      <span className="data w-9 shrink-0 text-right text-ink">{formatConfidence(value)}</span>
    </div>
  )
}

/**
 * The density filter, and the only one: four square swatches sharing hairlines. Pressed shows a
 * filled swatch; released, an empty outline. The level's name is the button's name and tooltip.
 */
export function DensityToggles({
  value,
  onChange,
  className,
}: {
  value: readonly DensityLevel[]
  onChange: (levels: DensityLevel[]) => void
  className?: string
}) {
  const toggle = (level: DensityLevel) =>
    onChange(
      DENSITY_LEVEL_IDS.filter((l) => (l === level ? !value.includes(level) : value.includes(l))),
    )
  return (
    <div
      role="group"
      aria-label="Density levels shown"
      data-toolbar-control=""
      className={cn(TOOLBAR_CONTROL, 'overflow-hidden', className)}
    >
      {DENSITY_LEVEL_IDS.map((level, index) => {
        const on = value.includes(level)
        const meta = DENSITY_LEVELS[level]
        return (
          <Tooltip
            key={level}
            content={`${meta.label}: ${on ? 'shown' : 'hidden'}. ${meta.meaning}.`}
            side="bottom"
          >
            <button
              type="button"
              aria-pressed={on}
              aria-label={meta.label}
              onClick={() => toggle(level)}
              className={cn(
                'inline-flex h-full w-8 items-center justify-center hover:bg-ink/5 max-sm:w-10',
                index > 0 && 'border-l border-hairline',
              )}
            >
              <span
                aria-hidden
                className="size-3 border-[1.5px]"
                style={{
                  borderColor: meta.stroke,
                  backgroundColor: on ? meta.color : 'transparent',
                }}
              />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
