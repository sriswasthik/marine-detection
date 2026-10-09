import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { buttonStyles, type ButtonSize } from './buttonStyles'

export interface ArrowLinkProps extends Omit<LinkProps, 'children'> {
  children: ReactNode
  size?: ButtonSize
}

/** The tertiary action as a link: accent text with a trailing arrow. */
export function ArrowLink({ children, size = 'md', className, ...rest }: ArrowLinkProps) {
  return (
    <Link className={buttonStyles({ variant: 'tertiary', size, className })} {...rest}>
      {children}
      <ArrowRight aria-hidden />
    </Link>
  )
}
