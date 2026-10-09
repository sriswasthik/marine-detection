import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { breadcrumbsFor } from '@/lib/navigation'

/**
 * Under the top bar on deep pages: where you are (breadcrumbs, "Observations / Ennore coast /
 * Report") and, on the right, the page's single secondary action. Renders nothing on top-level
 * pages.
 */
export function ContextLine({
  region,
  glyph,
  action,
  className,
}: {
  /** The observation's region once it has loaded; the crumb reads "Observation" until then. */
  region: string | null
  /** The observation's glyph, before its crumb. */
  glyph?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const { pathname } = useLocation()
  const crumbs = breadcrumbsFor(pathname, region)
  if (!crumbs) return null
  return (
    <div
      className={cn(
        'flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-hairline py-2',
        className,
      )}
    >
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 flex-wrap items-center gap-2 text-small">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-ink-2">
                  /
                </span>
              ) : null}
              {index === 1 ? glyph : null}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  className="truncate text-ink-2 underline-offset-4 hover:text-ink hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-10 pointer-coarse:items-center"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-medium text-ink">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </div>
  )
}
