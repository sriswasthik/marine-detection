import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Placeholder block shown while content loads. Decorative: hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-control bg-border/70', className)}
    />
  )
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
      <Skeleton className="h-7 w-72 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  )
}

/** A Card: bordered surface with a title line and text lines, or custom content. */
export function SkeletonCard({
  title = true,
  lines = 3,
  className,
  children,
}: {
  title?: boolean
  lines?: number
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-subtle',
        className,
      )}
    >
      {title ? <Skeleton className="h-5 w-40" /> : null}
      {children ?? <SkeletonText lines={lines} />}
    </div>
  )
}

/** A grid of MetricCards: label, figure and footnote, in the same box as the real card. */
export function SkeletonMetricCards({ count, className }: { count: number; className?: string }) {
  return (
    <div aria-hidden className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-subtle"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

/** A table: header row and body rows at the real row height (about 37px). */
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
      <div className="flex gap-4 border-b border-border py-2.5">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className={cn('h-3 flex-1', c === 0 && 'max-w-24')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex h-[37px] items-center gap-4 border-b border-border last:border-0"
        >
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
      <span className="absolute inset-0 animate-pulse bg-border/30" />
      <span className="absolute top-1/2 left-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-control border border-dashed border-border-strong" />
      {controls ? (
        <span className="absolute top-3 right-3 flex flex-col gap-1">
          <Skeleton className="size-8 bg-surface" />
          <Skeleton className="size-8 bg-surface" />
        </span>
      ) : null}
    </div>
  )
}
