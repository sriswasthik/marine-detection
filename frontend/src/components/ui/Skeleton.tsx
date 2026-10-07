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
