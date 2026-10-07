import type { Path } from 'leaflet'
import { memo, useCallback, useMemo, useState } from 'react'
import { Rectangle } from 'react-leaflet'
import { DENSITY_LEVELS, type DensityCell, type DensityGrid } from '@/lib/density'
import { formatCoveragePercent } from '@/lib/format'
import { boundsCenter, boundsToLeaflet, latLngToTuple } from '@/lib/geo'
import { getDensityCellStyle } from '@/lib/map/detectionStyle'
import { HoverTooltip } from './HoverTooltip'

const DENSITY_TOOLTIP_OFFSET: [number, number] = [0, 0]

const DensityCellShape = memo(function DensityCellShape({
  cell,
  hovered,
  interactive,
  onImagery,
  onHover,
}: {
  cell: DensityCell & { level: NonNullable<DensityCell['level']> }
  hovered: boolean
  interactive: boolean
  onImagery: boolean
  onHover: (id: string | null) => void
}) {
  const bounds = useMemo(() => boundsToLeaflet(cell.bounds), [cell.bounds])
  const eventHandlers = useMemo(
    () => ({
      // Cells sit under the detections on the shared canvas, whenever they are switched on.
      add: (event: { target: Path }) => event.target.bringToBack(),
      ...(interactive ? { mouseover: () => onHover(cell.id), mouseout: () => onHover(null) } : {}),
    }),
    [interactive, cell.id, onHover],
  )
  return (
    <Rectangle
      bounds={bounds}
      pathOptions={getDensityCellStyle(cell.level, hovered, onImagery)}
      interactive={interactive}
      eventHandlers={eventHandlers}
    />
  )
})

/** Grid cells with debris, as flat rectangles under the detections. Empty cells are not drawn. */
export const DensityLayer = memo(function DensityLayer({
  grid,
  interactive,
  onImagery,
}: {
  grid: DensityGrid
  interactive: boolean
  onImagery: boolean
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const onHover = useCallback((id: string | null) => setHoveredId(id), [])
  const cells = useMemo(
    () =>
      grid.cells.filter(
        (cell): cell is DensityCell & { level: NonNullable<DensityCell['level']> } =>
          cell.level !== null,
      ),
    [grid],
  )
  const hovered = cells.find((cell) => cell.id === hoveredId)

  return (
    <>
      {cells.map((cell) => (
        <DensityCellShape
          key={cell.id}
          cell={cell}
          hovered={cell.id === hoveredId}
          interactive={interactive}
          onImagery={onImagery}
          onHover={onHover}
        />
      ))}
      {hovered ? (
        <HoverTooltip
          position={latLngToTuple(boundsCenter(hovered.bounds))}
          offset={DENSITY_TOOLTIP_OFFSET}
        >
          <div className="mwi-tooltip__row">
            <span className="mwi-tooltip__title">
              {DENSITY_LEVELS[hovered.level].label} density
            </span>
          </div>
          <div className="mwi-tooltip__row">
            <span className="mwi-tooltip__muted">Cell covered</span>
            <span>{formatCoveragePercent(hovered.coveragePercent)}</span>
          </div>
        </HoverTooltip>
      ) : null}
    </>
  )
})
