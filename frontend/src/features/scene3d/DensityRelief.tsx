import { lazy, useMemo, useRef, useState } from 'react'
import { SectionLabel, SeverityTag } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { useFormat } from '@/features/settings/settingsContext'
import type { ObservationAnalysis } from '@/lib/analysis'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatCoveragePercent, formatLength } from '@/lib/format'
import { reliefBars, reliefExtent, reliefPosition, type ReliefBar } from '@/lib/scene3d'
import { SceneHost } from './SceneHost'

const DensityReliefScene = lazy(() => import('./scenes/DensityReliefScene'))

/** How many hotspots get a beacon. */
const BEACONS = 3

/**
 * The density grid in 3D: one bar per grid cell holding debris, its height the square root of the
 * cell's debris coverage, its colour the cell's density level; beacons over the top hotspots.
 * Hovering a bar reads out that cell. The same figures are in the density summary below.
 */
export function DensityRelief({
  observation,
  analysis,
}: {
  observation: Pick<Observation, 'bounds' | 'region'>
  analysis: ObservationAnalysis
}) {
  const fmt = useFormat()
  const grid = analysis.grid
  const bars = useMemo(() => (grid ? reliefBars(grid) : []), [grid])
  const [hovered, setHovered] = useState<ReliefBar | null>(null)
  const labels = useRef(new Map<string, HTMLElement>())
  const hotspots = useMemo(() => {
    if (!grid) return []
    return analysis.hotspots.slice(0, BEACONS).map((spot) => ({
      id: spot.id,
      rank: spot.rank,
      level: spot.level,
      ...reliefPosition(spot.centroid, grid.bounds, grid),
    }))
  }, [analysis.hotspots, grid])

  if (!grid || bars.length === 0) return null
  const extent = reliefExtent(grid)

  return (
    <section aria-labelledby="relief-title" className="flex flex-col gap-4">
      <SectionLabel
        id="relief-title"
        count={bars.length}
        action={<span className="text-small text-ink-2">Drag to turn</span>}
      >
        Density relief
      </SectionLabel>
      <div className="overflow-hidden border border-hairline bg-raised">
        <SceneHost
          className="h-[360px] sm:h-[420px]"
          fallback={
            <p className="flex h-full items-center justify-center px-6 text-center text-small text-ink-2">
              The 3D relief needs WebGL. The same figures are in the density summary below.
            </p>
          }
          overlay={(live) =>
            live ? (
              <>
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  {hotspots.map((spot) => (
                    <span
                      key={spot.id}
                      ref={(element) => {
                        if (element) labels.current.set(spot.id, element)
                        else labels.current.delete(spot.id)
                      }}
                      style={{ opacity: 0 }}
                      className="data absolute top-0 left-0 -translate-x-1/2 -translate-y-full border border-hairline bg-raised px-2 py-1 whitespace-nowrap text-tar"
                    >
                      Hotspot {spot.rank} · {DENSITY_LEVELS[spot.level].label}
                    </span>
                  ))}
                </div>
                <div
                  role="status"
                  className="pointer-events-none absolute top-3 left-3 min-h-14 border-l-2 border-ink bg-raised px-3 py-2"
                >
                  {hovered ? (
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <SeverityTag level={hovered.level} variant="plain" />
                        <span className="data text-ink-2">Cell {hovered.id}</span>
                      </span>
                      <span className="data text-ink">
                        {formatCoveragePercent(hovered.coveragePercent)} covered ·{' '}
                        {fmt.area(hovered.debrisAreaM2)}
                      </span>
                    </div>
                  ) : (
                    <p className="max-w-56 text-small text-ink-2">
                      Point at a bar to read its cell. Height grows with debris coverage.
                    </p>
                  )}
                </div>
              </>
            ) : null
          }
        >
          {(runtime) => (
            <DensityReliefScene
              {...runtime}
              bars={bars}
              extent={extent}
              rows={grid.rows}
              cols={grid.cols}
              hotspots={hotspots}
              onHover={setHovered}
              labels={labels}
            />
          )}
        </SceneHost>
      </div>
      <p className="text-small text-ink-2">
        Each bar is one {formatLength(grid.cellSizeM)} grid cell of {observation.region} holding
        possible debris. Height is the square root of its coverage, so small cells stay visible.
      </p>
    </section>
  )
}
