import { Ellipsis } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from '../navigation'

/** Plain text navigation in the top bar. The current page: ink text and a 2px ink underline. */
export function PrimaryNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Primary" className={cn('h-full', className)}>
      <ul className="flex h-full items-stretch gap-6">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center text-body transition-colors duration-[120ms] ease-out',
                  'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5',
                  isActive
                    ? 'font-medium text-ink after:bg-ink'
                    : 'text-ink-2 after:bg-transparent hover:text-ink',
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

/**
 * Phones and tablets (under 900px): a bottom tab bar with the four main sections and More,
 * which opens a sheet with everything else.
 */
export function BottomTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const tabClass = (active: boolean) =>
    cn(
      'relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-label tracking-normal',
      'before:absolute before:inset-x-3 before:top-0 before:h-0.5',
      active ? 'font-medium text-ink before:bg-ink' : 'text-ink-2 before:bg-transparent',
    )
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 h-tabbar border-t border-rule bg-paper nav:hidden print:hidden"
    >
      <ul className="flex h-full items-stretch">
        {NAV_ITEMS.filter((item) => item.tab).map((item) => (
          <li key={item.to} className="flex flex-1">
            <NavLink to={item.to} end={item.end} className={({ isActive }) => tabClass(isActive)}>
              <item.icon aria-hidden className="size-5" strokeWidth={1.5} />
              {item.label}
            </NavLink>
          </li>
        ))}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={tabClass(moreOpen)}
          >
            <Ellipsis aria-hidden className="size-5" strokeWidth={1.5} />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}
