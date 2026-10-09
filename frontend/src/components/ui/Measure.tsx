import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { InfoTip } from './InfoTip'
import { Skeleton } from './Skeleton'
import { Tag, type TagTone } from './Tag'

export interface MeasureProps {
  label: string
  /** Already formatted with a src/lib/format function. */
  value: ReactNode
  unit?: string
  /** Explains how the figure is derived. Shown in a tooltip. */
  hint?: ReactNode
  status?: { tone: TagTone; label: string }
  /** Small supporting line under the value. */
  footnote?: ReactNode
  loading?: boolean
  /** `title` (22px) in rows of measures; `page` (32px) where one measure leads. */
  size?: 'title' | 'page'
  className?: string
}

/**
 * One measured figure on the paper: a small-caps label, the figure (tabular, unit smaller after
 * it) and an optional footnote. No box: rows of measures are ruled with hairlines by the page.
 */
export function Measure({
  label,
  value,
  unit,
  hint,
  status,
  footnote,
  loading = false,
  size = 'title',
  className,
}: MeasureProps) {
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        <span id={labelId} className="label text-ink-2">
          {label}
        </span>
        {hint ? <InfoTip label={label}>{hint}</InfoTip> : null}
        {status ? (
          <Tag tone={status.tone} className="ml-auto">
            {status.label}
          </Tag>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className={size === 'page' ? 'h-10 w-32' : 'h-7 w-28'} />
      ) : (
        <div className="flex min-w-0 items-baseline gap-1">
          <span
            className={cn('num truncate text-ink', size === 'page' ? 'text-page' : 'text-title')}
          >
            {value}
          </span>
          {unit ? <span className="text-small text-ink-2">{unit}</span> : null}
        </div>
      )}
      {footnote ? <p className="text-small text-ink-2">{footnote}</p> : null}
    </div>
  )
}
