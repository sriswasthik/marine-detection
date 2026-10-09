import { formatInteger } from '@/lib/format'

/** "42 of 58 detections shown · 3 hotspots". Announced politely as filters change. */
export function ResultStrip({
  shown,
  total,
  hotspots,
  matches,
  filtered,
  onReset,
}: {
  shown: number
  total: number
  hotspots: number
  /** False when the observation itself is outside the source, date or region filters. */
  matches: boolean
  /** Whether any filter is active. */
  filtered: boolean
  onReset: () => void
}) {
  const noun = total === 1 ? 'detection' : 'detections'
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-control border border-border bg-surface px-2.5 py-1 text-caption text-ink shadow-subtle"
    >
      <span className="num">
        {filtered ? (
          <>
            <span className="font-medium">{formatInteger(shown)}</span> of {formatInteger(total)}{' '}
            {noun} shown
          </>
        ) : (
          <>
            <span className="font-medium">{formatInteger(total)}</span> {noun}
          </>
        )}
      </span>
      {total > 0 ? (
        <span className="num text-ink-muted">
          · {formatInteger(hotspots)} {hotspots === 1 ? 'hotspot' : 'hotspots'}
        </span>
      ) : null}
      {!matches ? (
        <span className="text-ink-muted">
          · This observation is outside the current filters.{' '}
          <button
            type="button"
            onClick={onReset}
            className="font-medium text-accent hover:underline"
          >
            Reset filters
          </button>
        </span>
      ) : null}
    </div>
  )
}
