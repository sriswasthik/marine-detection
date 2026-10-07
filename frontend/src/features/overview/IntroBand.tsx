import { ArrowRight, ScanSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles } from '@/components/ui'
import { PipelineStrip } from './PipelineStrip'

/** Product statement, the two entry points, and the pipeline legend. No illustration. */
export function IntroBand({ latestMapPath }: { latestMapPath: string | null }) {
  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-10">
      <div className="max-w-2xl">
        <p className="text-caption font-medium tracking-wide text-accent uppercase">
          Marine debris monitoring
        </p>
        <h1 id="overview-title" className="mt-3 text-display text-balance text-ink">
          Detect marine debris and understand exactly where it is.
        </h1>
        <p className="mt-3 max-w-xl text-body text-ink-muted">
          Satellite and drone images go in. Out come measured debris regions on a map, a density
          level for each area, and a ranked list of where to inspect first.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/analyze" className={buttonStyles({ variant: 'primary' })}>
            <ScanSearch aria-hidden />
            Analyze new imagery
          </Link>
          {latestMapPath ? (
            <Link to={latestMapPath} className={buttonStyles({ variant: 'ghost' })}>
              Open latest map
              <ArrowRight aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
      <PipelineStrip />
    </section>
  )
}
