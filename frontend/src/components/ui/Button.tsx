import { ArrowRight } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { buttonStyles, type ButtonSize, type ButtonVariant } from './buttonStyles'
import { Spinner } from './Spinner'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner in place of the start icon and blocks clicks. The label stays. */
  loading?: boolean
  iconStart?: ReactNode
  /** Tertiary buttons end with an arrow unless this replaces it; null leaves it out. */
  iconEnd?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  iconStart,
  iconEnd,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const end =
    iconEnd !== undefined ? iconEnd : variant === 'tertiary' ? <ArrowRight aria-hidden /> : null
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, loading, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      {...rest}
    >
      {loading ? <Spinner size="sm" label={null} /> : iconStart}
      {children}
      {loading ? null : end}
    </button>
  )
}
