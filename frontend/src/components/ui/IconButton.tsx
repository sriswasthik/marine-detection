import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { buttonStyles, ICON_BUTTON_SIZES, type ButtonSize } from './buttonStyles'
import { Tooltip } from './Tooltip'

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Accessible name. Also shown as a tooltip unless `tooltip` is false. */
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'secondary'
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
      className={buttonStyles({ variant, size, className: cn(ICON_BUTTON_SIZES[size], className) })}
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
