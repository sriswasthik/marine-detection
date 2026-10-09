import { ChevronDown, Layers, Maximize, Minus, Plus, RotateCcw } from 'lucide-react'
import { useId, useState, type ReactNode, type RefObject } from 'react'
import { Checkbox, SegmentedControl, Tooltip } from '@/components/ui'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { BASEMAP_ORDER, BASEMAPS, type BasemapId } from '@/lib/map/basemaps'
import {
  MAP_LAYER_IDS,
  MAP_LAYER_LABELS,
  type MapLayerId,
  type VisibleLayers,
} from '@/lib/map/layers'
import type { MapHandle } from './MapView'

const PANEL = 'rounded-control border border-border bg-surface shadow-subtle'

function ControlButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip content={label} side="bottom" align="end">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'inline-flex size-8 items-center justify-center text-ink transition-colors duration-150 ease-out',
          'hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4',
        )}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

export interface MapControlsProps {
  mapRef: RefObject<MapHandle | null>
  basemap: BasemapId
  onBasemapChange: (basemap: BasemapId) => void
  visibleLayers: VisibleLayers
  onToggleLayer: (layer: MapLayerId) => void
  hasDetections: boolean
  className?: string
}

/** Top-right map controls: basemap, layers, zoom and view. White, bordered, no glass. */
export function MapControls({
  mapRef,
  basemap,
  onBasemapChange,
  visibleLayers,
  onToggleLayer,
  hasDetections,
  className,
}: MapControlsProps) {
  const isWide = useMediaQuery('(min-width: 640px)')
  const [layersOpenOverride, setLayersOpenOverride] = useState<boolean | null>(null)
  const layersOpen = layersOpenOverride ?? isWide
  const panelId = useId()

  return (
    <div className={cn('flex flex-col items-end gap-2', className)}>
      <SegmentedControl
        label="Basemap"
        size="sm"
        value={basemap}
        onChange={onBasemapChange}
        options={BASEMAP_ORDER.map((id) => ({ value: id, label: BASEMAPS[id].label }))}
        className="border-border bg-surface shadow-subtle"
      />

      <div className={cn(PANEL, 'w-44')}>
        <button
          type="button"
          aria-expanded={layersOpen}
          aria-controls={panelId}
          onClick={() => setLayersOpenOverride(!layersOpen)}
          className="flex h-8 w-full items-center gap-2 rounded-control px-2.5 text-small font-medium text-ink hover:bg-bg"
        >
          <Layers aria-hidden className="size-4 text-ink-muted" />
          <span className="flex-1 text-left">Layers</span>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 text-ink-muted transition-transform duration-150 ease-out',
              layersOpen && 'rotate-180',
            )}
          />
        </button>
        <fieldset
          id={panelId}
          hidden={!layersOpen}
          className="flex flex-col gap-2 border-t border-border px-2.5 py-2.5"
        >
          <legend className="sr-only">Visible layers</legend>
          {MAP_LAYER_IDS.map((layer) => (
            <Checkbox
              key={layer}
              label={MAP_LAYER_LABELS[layer]}
              checked={visibleLayers[layer]}
              onChange={() => onToggleLayer(layer)}
            />
          ))}
        </fieldset>
      </div>

      <div
        className={cn(PANEL, 'flex flex-col overflow-hidden')}
        role="group"
        aria-label="Map view"
      >
        <ControlButton
          label="Zoom in"
          icon={<Plus aria-hidden />}
          onClick={() => mapRef.current?.zoomIn()}
        />
        <span aria-hidden className="h-px bg-border" />
        <ControlButton
          label="Zoom out"
          icon={<Minus aria-hidden />}
          onClick={() => mapRef.current?.zoomOut()}
        />
        <span aria-hidden className="h-px bg-border" />
        <ControlButton
          label="Fit to detections"
          icon={<Maximize aria-hidden />}
          disabled={!hasDetections}
          onClick={() => mapRef.current?.fitToDetections()}
        />
        <span aria-hidden className="h-px bg-border" />
        <ControlButton
          label="Reset view"
          icon={<RotateCcw aria-hidden />}
          onClick={() => mapRef.current?.resetView()}
        />
      </div>
    </div>
  )
}
