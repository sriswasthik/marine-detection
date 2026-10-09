import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SectionLabelProps {
  children: ReactNode
  /** Optional count after the text, in mono: "HOTSPOTS · 3". */
  count?: number | string
  /** Heading level; `p` when the label only decorates (the section is named elsewhere). */
  as?: 'h2' | 'h3' | 'h4' | 'p'
  id?: string
  /** A small control at the right end of the rule, for example a text link. */
  action?: ReactNode
  className?: string
}

/**
 * Signature element 1: an 11px small-caps label, a 12px gap, then a 1px rule running to the right
 * edge of its column. Every section on a document page starts with one, instead of a boxed title.
 */
export function SectionLabel({
  children,
  count,
  as: Tag = 'h2',
  id,
  action,
  className,
}: SectionLabelProps) {
  return (
    <div className={cn('flex min-h-5 items-center gap-3', className)}>
      <Tag id={id} className="label shrink-0 text-ink-2">
        {children}
        {count !== undefined ? (
          <span className="font-mono font-normal tracking-normal">
            {' · '}
            {count}
          </span>
        ) : null}
      </Tag>
      <span aria-hidden className="h-px min-w-6 flex-1 bg-rule" />
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
