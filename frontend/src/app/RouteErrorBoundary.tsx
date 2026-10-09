import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ArrowLink, ErrorState } from '@/components/ui'
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
    <div className="mx-auto w-full max-w-page px-4 py-8 sm:px-6 lg:px-8">
      <ErrorState
        headingLevel={1}
        error={error}
        retryLabel="Reload page"
        action={<ArrowLink to="/">Go to overview</ArrowLink>}
      />
    </div>
  )
}
