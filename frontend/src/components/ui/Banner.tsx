import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BannerTone = 'info' | 'warning' | 'danger'

const TONES: Record<BannerTone, { rule: string; icon: string; Icon: typeof Info }> = {
  info: { rule: 'border-accent-ink', icon: 'text-accent-ink', Icon: Info },
  warning: { rule: 'border-warning', icon: 'text-warning', Icon: TriangleAlert },
  danger: { rule: 'border-danger', icon: 'text-danger', Icon: CircleAlert },
}

export interface BannerProps {
  tone?: BannerTone
  title?: ReactNode
  children?: ReactNode
  /** A button or link, for example "Review warnings". */
  action?: ReactNode
  onDismiss?: () => void
  /** `inline` sits in the page; `bar` spans the full width under the top bar, for app-wide notices. */
  variant?: 'inline' | 'bar'
  /** `sm`: 13px text, for side panels. */
  size?: 'md' | 'sm'
  className?: string
}

/**
 * Inline notice about the current page: no fill, a 2px left rule in the status colour and an icon
 * in the same colour. Danger banners are announced immediately.
 */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  variant = 'inline',
  size = 'md',
  className,
}: BannerProps) {
  const { rule, icon, Icon } = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 text-ink',
        size === 'sm' ? 'text-small' : 'text-body',
        variant === 'inline'
          ? cn('border-l-2 py-1 pl-3', rule)
          : 'hairline-b bg-paper px-4 py-2 sm:px-6',
        className,
      )}
    >
      <span className="flex h-5 shrink-0 items-center">
        <Icon aria-hidden className={cn('size-4', icon)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? <div className="text-ink-2">{children}</div> : null}
        </div>
        {action ? <div className="mt-2 shrink-0 sm:mt-0">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
