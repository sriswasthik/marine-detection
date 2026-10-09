import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ICON_BUTTON_SIZES, type ButtonSize } from './buttonStyles'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Accessible name. Also shown as a tooltip unless `tooltip` is false. */
  label: string
  icon: ReactNode
  /** `ghost` inside toolbars; `outline` (a hairline frame) when the button stands alone. */
  variant?: 'ghost' | 'outline'
  size?: ButtonSize
  tooltip?: boolean
  tooltipSide?: 'top' | 'bottom'
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  tooltip = true,
  tooltipSide = 'bottom',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control text-ink transition-colors duration-[120ms] ease-out',
        'hover:bg-ink/5 active:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        ICON_BUTTON_SIZES[size],
        variant === 'outline' && 'border border-hairline hover:border-rule',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
  return tooltip ? (
    <Tooltip content={label} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  )
}
