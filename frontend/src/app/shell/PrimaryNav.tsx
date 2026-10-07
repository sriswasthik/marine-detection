import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from '../navigation'

/** Horizontal navigation in the top bar. Active: ink text and a 2px accent underline. */
export function PrimaryNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Primary" className={cn('h-full', className)}>
      <ul className="flex h-full items-stretch">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center px-2.5 text-body font-medium transition-colors duration-150 ease-out lg:px-3',
                  'after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full lg:after:inset-x-3',
                  isActive
                    ? 'text-ink after:bg-accent'
                    : 'text-ink-muted after:bg-transparent hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Vertical navigation for the mobile menu sheet. */
export function SheetNav({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav aria-label="Primary">
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'relative flex h-11 items-center rounded-control px-3 text-body font-medium transition-colors duration-150 ease-out',
                  'before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full',
                  isActive
                    ? 'bg-bg text-ink before:bg-accent'
                    : 'text-ink-muted before:bg-transparent hover:bg-bg hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
