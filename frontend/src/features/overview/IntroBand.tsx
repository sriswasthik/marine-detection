import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ANALYZE_LABEL } from '@/app/navigation'
import { useClaimPrimaryAction } from '@/app/shell/primaryAction'
import { ArrowLink, buttonStyles, SeveritySwatch, Tag } from '@/components/ui'
import type { ObservationSummary } from '@/features/observations/types'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { OrbitalGlobe } from '@/features/scene3d/OrbitalGlobe'
import { useFormat } from '@/features/settings/settingsContext'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatInteger } from '@/lib/format'
import { fleetSummary } from '@/lib/kpis'
import { SENTINEL2 } from '@/lib/scene3d'
import { PipelineStrip } from './PipelineStrip'

/** What it is, who it is for, why it matters: the three answers the first screen owes a visitor. */
function Brief() {
  return (
    <dl className="grid gap-6 border-t border-ink pt-6 sm:grid-cols-3 sm:gap-8">
      <div className="flex flex-col gap-2">
        <dt className="flex items-baseline gap-3 text-small font-medium text-tar">
          <span className="data text-ink-2">01</span>What it is
        </dt>
        <dd className="text-small text-ink-2">
          A segmentation model that reads 11-band Sentinel-2 images and maps possible floating
          debris, measured and graded by density.
        </dd>
      </div>
      <div className="flex flex-col gap-2">
        <dt className="flex items-baseline gap-3 text-small font-medium text-tar">
          <span className="data text-ink-2">02</span>Who it is for
        </dt>
        <dd className="text-small text-ink-2">
          Coastal authorities, cleanup crews and researchers deciding where to send a boat.
        </dd>
      </div>
      <div className="flex flex-col gap-2">
        <dt className="flex items-baseline gap-3 text-small font-medium text-tar">
          <span className="data text-ink-2">03</span>Why it matters
        </dt>
        <dd className="text-small text-ink-2">
          Debris drifts, breaks apart and washes ashore. Sentinel-2 images every coast at least
          every {SENTINEL2.revisitDays} days, so crews can act on fresh evidence, not reports.
        </dd>
      </div>
    </dl>
  )
}

/**
 * The first screen. Left: the promise, the brief and the next step (this view's one primary
 * action, so the top bar steps aside). Right: every observation on a globe under Sentinel-2's
 * orbit, with the totals beneath. Then the pipeline as one line.
 */
export function IntroBand({
  latestMapPath,
  observations = [],
  sampleData = false,
}: {
  latestMapPath: string | null
  observations?: readonly ObservationSummary[]
  /** True on sample data: the globe and figures say so. */
  sampleData?: boolean
}) {
  useClaimPrimaryAction(true)
  const navigate = useNavigate()
  const fmt = useFormat()
  const fleet = useMemo(() => fleetSummary(observations), [observations])

  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-12">
      <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-8 lg:col-span-7">
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-3 text-small text-ink-2">
              <span aria-hidden className="live-dot" />
              Marine debris monitoring from Sentinel-2
            </p>
            <h1
              id="overview-title"
              className="display max-w-[16ch] text-page text-balance text-tar sm:text-figure"
            >
              See floating marine debris from orbit, and know where to clean up first.
            </h1>
          </div>

          <Brief />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              to="/analyze"
              className={buttonStyles({ variant: 'primary', className: 'h-12 px-6' })}
            >
              {ANALYZE_LABEL}
              <span aria-hidden className="text-white/60 max-sm:hidden">
                ─ 11-band GeoTIFF
              </span>
              <ArrowRight aria-hidden />
            </Link>
            {sampleData ? (
              <Link
                to="/analyze?sample=1"
                className={buttonStyles({ variant: 'secondary', className: 'h-12 px-6' })}
              >
                Try a sample scene
              </Link>
            ) : null}
            {latestMapPath ? <ArrowLink to={latestMapPath}>Open latest map</ArrowLink> : null}
          </div>
        </div>

        <figure className="relative lg:col-span-5">
          <OrbitalGlobe
            observations={observations}
            onSelect={(id) => navigate(`/map/${encodeURIComponent(id)}`)}
            className="h-[340px] sm:h-[440px] lg:h-[500px]"
          />
          <figcaption className="flex flex-col gap-2 border-t border-hairline pt-3">
            {fleet.observations > 0 ? (
              <p className="data text-ink">
                {formatInteger(fleet.observations)} observations · {formatInteger(fleet.detections)}{' '}
                possible debris regions · {fmt.area(fleet.debrisAreaM2)}
              </p>
            ) : null}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-2">
              {sampleData ? <Tag tone="warning">Sample data</Tag> : null}
              Each beam is an observation: colour by density level, height by detections.
            </p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-2">
              {DENSITY_LEVEL_IDS.map((level) => (
                <span key={level} className="inline-flex items-center gap-2">
                  <SeveritySwatch level={level} />
                  {DENSITY_LEVELS[level].label}
                </span>
              ))}
            </p>
          </figcaption>
        </figure>
      </div>
      <PipelineStrip />
    </section>
  )
}
