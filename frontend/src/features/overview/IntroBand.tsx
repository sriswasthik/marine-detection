import { ArrowLink } from '@/components/ui'
import { BRAND } from '@/lib/brand'
import { PipelineStrip } from './PipelineStrip'

/**
 * Product statement, a way into the latest map, and the pipeline legend. No illustration.
 * "Analyze new imagery" is the top bar's primary action, so it is not repeated here.
 */
export function IntroBand({ latestMapPath }: { latestMapPath: string | null }) {
  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-10">
      <div className="max-w-2xl">
        <p className="label text-accent-ink">{BRAND.long}</p>
        <h1 id="overview-title" className="mt-3 text-page text-balance text-ink">
          Detect marine debris and understand exactly where it is.
        </h1>
        <p className="mt-3 max-w-xl text-lead text-ink-2">
          Sentinel-2 satellite images go in. Out come possible debris regions measured on a map, a
          density level for each area, and a ranked list of where to inspect first.
        </p>
        {latestMapPath ? (
          <div className="mt-6">
            <ArrowLink to={latestMapPath}>Open latest map</ArrowLink>
          </div>
        ) : null}
      </div>
      <PipelineStrip />
    </section>
  )
}
