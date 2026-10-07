import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BannerTone = 'info' | 'warning' | 'danger'

const TONES: Record<BannerTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'border-accent/20 bg-info-soft', icon: 'text-accent', Icon: Info },
  warning: { box: 'border-warning/25 bg-warning-soft', icon: 'text-warning', Icon: TriangleAlert },
  danger: { box: 'border-danger/25 bg-danger-soft', icon: 'text-danger', Icon: CircleAlert },
}

export interface BannerProps {
  tone?: BannerTone
  title?: ReactNode
  children?: ReactNode
  /** A button or link, for example "Review warnings". */
  action?: ReactNode
  onDismiss?: () => void
  className?: string
}

/** Inline notice about the current page. Danger banners are announced immediately. */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  className,
}: BannerProps) {
  const { box, icon, Icon } = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-card border px-4 py-3 text-small text-ink',
        box,
        className,
      )}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? <div className="text-ink">{children}</div> : null}
        </div>
        {action ? <div className="mt-2 shrink-0 sm:mt-0">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
