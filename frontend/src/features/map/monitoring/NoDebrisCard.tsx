import { CircleCheck } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { formatConfidence, formatDateTime } from '@/lib/format'
import { useFormat } from '@/features/settings/settingsContext'

/**
 * The designed "No debris detected" state: what was scanned, when, and how much to trust it.
 * Shown over the map, with the footprint still visible around it.
 */
export function NoDebrisCard({ observation }: { observation: Observation }) {
  const fmt = useFormat()
  const metrics = observation.modelMetrics
  return (
    <section
      aria-labelledby="no-debris-title"
      className="w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-5 shadow-subtle"
    >
      <div className="flex items-center gap-2">
        <CircleCheck aria-hidden className="size-5 text-success" />
        <h2 id="no-debris-title" className="text-heading text-ink">
          No debris detected
        </h2>
      </div>
      <p className="mt-1.5 text-small text-ink-muted">
        The model checked the whole image and found no floating debris. A clear result is a valid
        result.
      </p>
      <dl className="mt-4 flex flex-col gap-2 text-small">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Area scanned</dt>
          <dd className="num font-medium text-ink">{fmt.area(observation.waterAreaM2)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Captured</dt>
          <dd className="num text-right text-ink">{formatDateTime(observation.capturedAt)}</dd>
        </div>
        {metrics ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">Model precision</dt>
            <dd className="flex items-center gap-2">
              {metrics.isPlaceholder ? <Badge tone="warning">Sample values</Badge> : null}
              <span className="num font-medium text-ink">
                {formatConfidence(metrics.precision)}
              </span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
