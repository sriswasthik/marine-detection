import { ArrowRight, CloudOff, RotateCcw, ServerCrash } from 'lucide-react'
import { Button } from '@/components/ui'
import { summaryText, type RunFailure, type RunSummary } from './runReducer'

export function SuccessPanel({
  summary,
  autoOpening,
  onViewResults,
  onAnalyzeAnother,
}: {
  summary: RunSummary | null
  /** The map opens on its own unless the user does something first. */
  autoOpening: boolean
  onViewResults: () => void
  onAnalyzeAnother: () => void
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div>
        <p className="num text-title text-ink">{summaryText(summary)}</p>
        <p className="text-small text-ink-muted">
          {autoOpening ? 'Opening the map in a moment.' : 'The results are ready on the map.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" iconEnd={<ArrowRight aria-hidden />} onClick={onViewResults}>
          View results
        </Button>
        <Button variant="ghost" onClick={onAnalyzeAnother}>
          Analyze another image
        </Button>
      </div>
    </div>
  )
}

/** Server and network failures: what happened, and a Retry that keeps the file and details. */
export function FailurePanel({
  failure,
  onRetry,
  onEdit,
}: {
  failure: RunFailure
  onRetry: () => void
  onEdit: () => void
}) {
  const Icon = failure.kind === 'network' ? CloudOff : ServerCrash
  return (
    <div role="alert" className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-danger-soft text-danger"
        >
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-heading text-ink">{failure.title}</p>
          <p className="text-small text-ink-muted">{failure.message}</p>
          {failure.code ? <p className="mono-label mt-1 text-ink-muted">{failure.code}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" iconStart={<RotateCcw aria-hidden />} onClick={onRetry}>
          Retry
        </Button>
        <Button variant="ghost" onClick={onEdit}>
          Edit details
        </Button>
      </div>
    </div>
  )
}
