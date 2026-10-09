import { lazy } from 'react'
import type { JobStep } from '@/features/observations/api/types'
import type { StepStatus } from '@/features/analyze/runReducer'
import { cn } from '@/lib/cn'
import { pipelinePhase, SPECTRAL_BANDS } from '@/lib/scene3d'
import { SceneHost } from './SceneHost'

const SpectralStackScene = lazy(() => import('./scenes/SpectralStackScene'))

/** The still stack: the band colours as skewed sheets, for no-WebGL browsers and while loading. */
function StackStill() {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center">
      <div className="relative h-40 w-56 [transform:rotateX(60deg)_rotateZ(-38deg)]">
        {SPECTRAL_BANDS.map((band, i) => (
          <div
            key={band.name}
            className="absolute inset-0 border opacity-50"
            style={{
              borderColor: band.color,
              background: `${band.color}10`,
              transform: `translateZ(${i * 6}px) translateY(${-i * 6}px)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The run as light: the 11 bands arrive with the upload, fan out while preprocessing, a scan
 * crosses them while the model detects, and the debris rises out of the classification layer.
 * An illustration of the pipeline driven by the real step statuses, not this image's pixels;
 * the caption says so.
 */
export function SpectralStack({
  statuses,
  uploadPercent,
  className,
}: {
  statuses: Readonly<Record<JobStep, StepStatus>>
  uploadPercent: number | null
  className?: string
}) {
  const phase = pipelinePhase(statuses)
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <SceneHost className="h-72 sm:h-80" fallback={<StackStill />}>
        {(runtime) => (
          <SpectralStackScene {...runtime} phase={phase} uploadPercent={uploadPercent} />
        )}
      </SceneHost>
      <figcaption className="flex flex-col gap-2">
        <ol aria-label="Bands the model reads" className="flex flex-wrap gap-1">
          {SPECTRAL_BANDS.map((band) => (
            <li
              key={band.name}
              title={`${band.name}, ${band.wavelengthNm} nm, ${band.region.toLowerCase()}`}
              className="data inline-flex items-center gap-1 px-1 text-ink-2"
            >
              <span aria-hidden className="size-2" style={{ background: band.color }} />
              {band.wavelengthNm}
            </li>
          ))}
        </ol>
        <p className="text-small text-ink-2">
          The 11 Sentinel-2 bands the model reads, in nanometres. An illustration of the pipeline,
          not the pixels of your image.
        </p>
      </figcaption>
    </figure>
  )
}
