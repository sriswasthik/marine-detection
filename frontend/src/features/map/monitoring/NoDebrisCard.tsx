import { CircleCheck } from 'lucide-react'
import { Tag } from '@/components/ui'
import type { Observation } from '@/features/observations/types'
import { formatConfidence, formatDateTime } from '@/lib/format'
import { useFormat } from '@/features/settings/settingsContext'

/**
 * The designed "No debris detected" state: what was scanned, when, and how much to trust it
 * (the model's debris recall: how much labelled debris it found in its evaluation).
 * Shown over the map, with the footprint still visible around it.
 */
export function NoDebrisCard({ observation }: { observation: Observation }) {
  const fmt = useFormat()
  const metrics = observation.modelMetrics
  return (
    <section
      aria-labelledby="no-debris-title"
      className="w-80 max-w-[calc(100vw-2rem)] border border-rule bg-sheet p-6"
    >
      <div className="flex items-center gap-2">
        <CircleCheck aria-hidden className="size-5 text-success" />
        <h2 id="no-debris-title" className="text-lead font-medium text-ink">
          No debris detected
        </h2>
      </div>
      <p className="mt-2 text-small text-ink-2">
        The model checked the whole image and found no floating debris. A clear result is a valid
        result.
      </p>
      <dl className="mt-4 flex flex-col gap-2 text-small">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Area scanned</dt>
          <dd className="data text-ink">{fmt.area(observation.waterAreaM2)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Captured</dt>
          <dd className="data text-right text-ink">{formatDateTime(observation.capturedAt)}</dd>
        </div>
        {metrics ? (
          // Recall, not precision: how much real debris the model finds is what a clear
          // result depends on. There are no detections, so there is no confidence to average.
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-2">Debris found in testing</dt>
            <dd className="flex items-center gap-2">
              {metrics.isPlaceholder ? <Tag tone="warning">Sample values</Tag> : null}
              <span className="data text-ink">{formatConfidence(metrics.recall)}</span>
            </dd>
          </div>
        ) : null}
      </dl>
      {metrics ? (
        <p className="mt-2 text-small text-ink-2">
          Share of labelled debris the model found in its evaluation. It describes the model, not
          this image.{' '}
          {metrics.isPlaceholder
            ? 'A placeholder until the model is evaluated.'
            : `Source: ${metrics.benchmark}.`}
        </p>
      ) : null}
    </section>
  )
}
