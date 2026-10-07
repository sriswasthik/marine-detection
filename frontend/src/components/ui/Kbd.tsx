import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** A keyboard key, for shortcut hints. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-b-2 border-border-strong bg-surface px-1',
        'font-mono text-[11px] leading-none text-ink-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
