import { Circle, CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CheckStatus, QualityCheck as Check } from './validate'

const STATUS: Record<CheckStatus, { label: string; Icon: typeof Circle; className: string }> = {
  pass: { label: 'Pass', Icon: CircleCheck, className: 'text-success' },
  warning: { label: 'Warning', Icon: TriangleAlert, className: 'text-warning' },
  fail: { label: 'Fail', Icon: CircleX, className: 'text-danger' },
  pending: { label: 'Checked later', Icon: Circle, className: 'text-ink-muted' },
}

/** The pre-flight checklist. Every status is spelled out, and failures say how to fix them. */
export function QualityCheck({ checks }: { checks: readonly Check[] }) {
  return (
    <section aria-labelledby="quality-title" className="flex flex-col gap-2">
      <h3 id="quality-title" className="text-heading text-ink">
        Quality check
      </h3>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {checks.map((check) => {
          const { label, Icon, className } = STATUS[check.status]
          return (
            <li key={check.id} className="flex items-start gap-3 py-2.5">
              <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', className)} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-small">
                  <span className="font-medium text-ink">{check.label}</span>
                  <span className={cn('text-caption font-medium', className)}>{label}</span>
                </p>
                <p className="text-small text-ink-muted">{check.detail}</p>
                {check.fix && check.status !== 'pass' ? (
                  <p className="text-small text-ink">{check.fix}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
