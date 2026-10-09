import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Placeholder bar shown while content loads: hairline-coloured, square, a slow opacity pulse that
 * stops under reduced motion. Decorative: hidden from assistive tech.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton-pulse block bg-hairline', className)} />
}

/** Lines of text-height skeletons, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </span>
  )
}

/**
 * Wraps a loading layout built from the variants below: one spoken label for assistive tech,
 * everything inside decorative. Compose it in the real page's shape so nothing jumps on load.
 */
export function PageSkeleton({
  label,
  children,
  className,
}: {
  /** Announced once, for example "Loading observation". */
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  )
}

/** Page header: optional breadcrumb, the h1 line and a meta line. */
export function SkeletonPageHeader({
  breadcrumb = false,
  className,
}: {
  breadcrumb?: boolean
  className?: string
}) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-2', className)}>
      {breadcrumb ? <Skeleton className="h-4 w-44" /> : null}
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  )
}

/** A section on the paper: its section label and rule, then text lines or custom content. */
export function SkeletonSection({
  lines = 3,
  className,
  children,
}: {
  lines?: number
  className?: string
  children?: ReactNode
}) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-4', className)}>
      <span className="flex items-center gap-3">
        <Skeleton className="h-3 w-24" />
        <span className="h-px flex-1 bg-rule" />
      </span>
      {children ?? <SkeletonText lines={lines} />}
    </div>
  )
}

/** Headline figures: label, a figure-height bar and a footnote each, ruled like the real row. */
export function SkeletonFigures({
  count,
  className,
  itemClassName,
}: {
  count: number
  className?: string
  itemClassName?: string
}) {
  return (
    <div aria-hidden className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn('flex flex-col gap-2', itemClassName)}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

/** A ledger: header row on a rule, then body rows at the real 40px row height. */
export function SkeletonTable({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  const widths = ['w-16', 'w-20', 'w-14', 'w-24', 'w-32', 'w-12']
  return (
    <div aria-hidden className={cn('flex flex-col', className)}>
      <div className="flex gap-4 border-b border-rule py-3">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className={cn('h-3 flex-1', c === 0 && 'max-w-24')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-10 items-center gap-4 border-b border-hairline">
          {Array.from({ length: columns }, (_, c) => (
            <span key={c} className="flex-1">
              <Skeleton className={cn('h-3', widths[(r + c) % widths.length])} />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * A map area: the map's own fallback colour with placeholder controls, so the frame keeps its size
 * and position while tiles and data load.
 */
export function SkeletonMap({
  className,
  controls = true,
}: {
  className?: string
  /** Placeholder for the zoom and layer controls in the top right. */
  controls?: boolean
}) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden bg-map-fallback', className)}>
      <span className="absolute top-1/2 left-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 border border-dashed border-rule" />
      {controls ? (
        <span className="absolute top-3 right-3 flex flex-col gap-1">
          <span className="block size-8 border border-hairline bg-sheet" />
          <span className="block size-8 border border-hairline bg-sheet" />
        </span>
      ) : null}
    </div>
  )
}
