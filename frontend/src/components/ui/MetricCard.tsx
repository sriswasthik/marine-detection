import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Badge, type BadgeTone } from './Badge'
import { Skeleton } from './Skeleton'
import { Tooltip } from './Tooltip'

export interface MetricCardProps {
  label: string
  /** Already formatted with a src/lib/format function. */
  value: ReactNode
  unit?: string
  /** Explains how the figure is derived. Shown in a tooltip. */
  hint?: ReactNode
  status?: { tone: BadgeTone; label: string }
  /** Small supporting line under the value. */
  footnote?: ReactNode
  loading?: boolean
  className?: string
}

export function MetricCard({
  label,
  value,
  unit,
  hint,
  status,
  footnote,
  loading = false,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-subtle',
        className,
      )}
    >
      <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="text-small font-medium text-ink-muted">{label}</span>
        {hint ? (
          <Tooltip content={hint} side="top">
            <button
              type="button"
              aria-label={`About ${label.toLowerCase()}`}
              className="-m-1 inline-flex size-6 items-center justify-center rounded-control text-ink-muted hover:text-ink"
            >
              <Info className="size-3.5" aria-hidden />
            </button>
          </Tooltip>
        ) : null}
        {status ? (
          <Badge tone={status.tone} className="ml-auto">
            {status.label}
          </Badge>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="num truncate text-display text-ink">{value}</span>
          {unit ? <span className="text-body text-ink-muted">{unit}</span> : null}
        </div>
      )}
      {footnote ? <p className="text-caption text-ink-muted">{footnote}</p> : null}
    </div>
  )
}
