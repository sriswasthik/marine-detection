import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** A keyboard key, for shortcut hints: a squared hairline frame with the key in mono. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-tag border border-rule px-1',
        'font-mono text-label leading-none font-normal tracking-normal text-ink-2',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
