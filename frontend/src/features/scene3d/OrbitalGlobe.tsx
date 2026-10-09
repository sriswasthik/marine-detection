import { lazy, useMemo, useRef, useState } from 'react'
import type { ObservationSummary } from '@/features/observations/types'
import { cn } from '@/lib/cn'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatInteger } from '@/lib/format'
import { globeMarkers } from '@/lib/scene3d'
import { SceneHost } from './SceneHost'

const OrbitalGlobeScene = lazy(() => import('./scenes/OrbitalGlobeScene'))

/** How many markers carry a floating label; the rest are beams only. */
const LABELLED = 5

/** The still globe: a ruled circle, for no-WebGL browsers and while loading. */
function GlobeStill() {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center">
      <div className="aspect-square w-[62%] max-w-[420px] rounded-full border border-rule bg-raised" />
    </div>
  )
}

/**
 * Hero: the observations on a turning globe, under Sentinel-2's orbit. Each observation is a beam
 * at the centre of its image, coloured by density level and as tall as its detection count
 * allows. Clicking a beam or its label opens that observation. The globe is a pointer shortcut:
 * the same observations are listed on the page.
 */
export function OrbitalGlobe({
  observations,
  onSelect,
  className,
}: {
  observations: readonly ObservationSummary[]
  onSelect: (id: string) => void
  className?: string
}) {
  const markers = useMemo(() => globeMarkers(observations), [observations])
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const labels = useRef(new Map<string, HTMLElement>())
  const labelled = useMemo(
    () => [...markers].sort((a, b) => b.detectionCount - a.detectionCount).slice(0, LABELLED),
    [markers],
  )

  return (
    <SceneHost
      className={className}
      fallback={<GlobeStill />}
      overlay={
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {labelled.map((marker) => {
            const color = marker.level ? DENSITY_LEVELS[marker.level].color : 'var(--color-success)'
            return (
              <button
                key={marker.id}
                type="button"
                tabIndex={-1}
                ref={(element) => {
                  if (element) labels.current.set(marker.id, element)
                  else labels.current.delete(marker.id)
                }}
                onPointerEnter={() => setHighlightedId(marker.id)}
                onPointerLeave={() => setHighlightedId(null)}
                onClick={() => onSelect(marker.id)}
                style={{ opacity: 0, pointerEvents: 'none', visibility: 'hidden' }}
                className={cn(
                  'absolute top-0 left-0 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap',
                  'flex items-center gap-2 border border-hairline bg-raised px-2 py-1',
                  'text-small text-ink transition-colors duration-150',
                  'hover:border-ink',
                  highlightedId === marker.id && 'border-ink',
                )}
              >
                <span className="size-2" style={{ background: color }} />
                <span className="font-medium">{marker.region}</span>
                <span className="data text-ink-2">{formatInteger(marker.detectionCount)}</span>
              </button>
            )
          })}
        </div>
      }
    >
      {(runtime) => (
        <OrbitalGlobeScene
          {...runtime}
          markers={markers}
          highlightedId={highlightedId}
          onHover={setHighlightedId}
          onSelect={onSelect}
          labels={labels}
        />
      )}
    </SceneHost>
  )
}
