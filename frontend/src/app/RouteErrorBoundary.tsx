import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { buttonStyles, ErrorState } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { toAppError } from '@/lib/errors/appError'

/**
 * Route-level error screen: a page that fails to render (or a route that errors) shows this inside
 * the shell, so navigation keeps working. Panels inside pages have their own ErrorBoundary.
 */
export function RouteErrorBoundary() {
  const routeError = useRouteError()
  const error = toAppError(isRouteErrorResponse(routeError) ? routeError.status : routeError, {
    retry: () => window.location.reload(),
  })
  useDocumentTitle(error.title)

  return (
    <div className="px-4 py-8">
      <ErrorState
        headingLevel={1}
        error={error}
        retryLabel="Reload page"
        action={
          <Link to="/" className={buttonStyles({ variant: 'ghost' })}>
            Go to overview
          </Link>
        }
      />
    </div>
  )
}
