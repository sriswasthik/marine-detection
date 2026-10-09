import { Maximize, Minus, Plus, RotateCcw } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { MapHandle } from './MapView'

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
          'inline-flex size-8 items-center justify-center text-ink transition-colors duration-[120ms] ease-out max-sm:size-10',
          'hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4',
        )}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

/**
 * The map's one control group, inset 16px at the top right: zoom in, zoom out, fit to detections
 * and reset. Layers and the basemap live in the side panel; shortcuts in the filters menu.
 */
export function MapControlGroup({
  mapRef,
  hasDetections,
  className,
}: {
  mapRef: RefObject<MapHandle | null>
  hasDetections: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Map view"
      data-chrome="overlay"
      className={cn(
        'absolute top-4 right-4 z-[500] flex flex-col divide-y divide-hairline border border-rule bg-sheet',
        className,
      )}
    >
      <ControlButton
        label="Zoom in"
        icon={<Plus aria-hidden />}
        onClick={() => mapRef.current?.zoomIn()}
      />
      <ControlButton
        label="Zoom out"
        icon={<Minus aria-hidden />}
        onClick={() => mapRef.current?.zoomOut()}
      />
      <ControlButton
        label="Fit to detections"
        icon={<Maximize aria-hidden />}
        disabled={!hasDetections}
        onClick={() => mapRef.current?.fitToDetections()}
      />
      <ControlButton
        label="Reset view"
        icon={<RotateCcw aria-hidden />}
        onClick={() => mapRef.current?.resetView()}
      />
    </div>
  )
}
