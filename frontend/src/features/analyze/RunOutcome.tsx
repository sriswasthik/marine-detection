import { ArrowRight, CloudOff, RotateCcw, ServerCrash } from 'lucide-react'
import { Banner, Button } from '@/components/ui'
import { summaryText, type RunFailure, type RunSummary } from './runReducer'

export function SuccessPanel({
  summary,
  onViewResults,
  onAnalyzeAnother,
}: {
  summary: RunSummary | null
  onViewResults: () => void
  onAnalyzeAnother: () => void
}) {
  const notices = summary?.notices ?? []
  return (
    <div className="flex flex-col gap-4 border-b border-hairline pb-5">
      <div>
        <p className="num text-title text-ink">{summaryText(summary)}</p>
        <p className="text-small text-ink-2">The full report is below.</p>
      </div>
      {/* Low confidence and approximate positions travel with the result, everywhere it shows. */}
      {notices.map((notice) => (
        <Banner key={notice.id} tone="warning" title={notice.title}>
          {notice.message}
        </Banner>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" iconEnd={<ArrowRight aria-hidden />} onClick={onViewResults}>
          Open on the map
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
  retryBlockedReason = null,
}: {
  failure: RunFailure
  onRetry: () => void
  onEdit: () => void
  /** Why Retry cannot run right now, for example while offline. */
  retryBlockedReason?: string | null
}) {
  const Icon = failure.kind === 'network' ? CloudOff : ServerCrash
  return (
    <div role="alert" className="flex flex-col gap-4 border-t border-hairline pt-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-danger-soft text-danger"
        >
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-lead font-medium text-ink">{failure.title}</p>
          <p className="text-small text-ink-2">{failure.message}</p>
          <p className="text-small text-ink-2">Your file and details are kept.</p>
          {failure.code ? <p className="data mt-1 text-ink-2">{failure.code}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            iconStart={<RotateCcw aria-hidden />}
            onClick={onRetry}
            disabled={retryBlockedReason !== null}
            aria-describedby={retryBlockedReason ? 'retry-reason' : undefined}
          >
            Retry
          </Button>
          <Button variant="ghost" onClick={onEdit}>
            Edit details
          </Button>
        </div>
        {retryBlockedReason ? (
          <p id="retry-reason" className="text-small text-ink-2">
            {retryBlockedReason}
          </p>
        ) : null}
      </div>
    </div>
  )
}
