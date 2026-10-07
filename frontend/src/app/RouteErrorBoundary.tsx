import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { buttonStyles, ErrorState } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function describe(error: unknown): { title: string; description: string; details?: string } {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: 'Page not found',
        description:
          'The address does not match any page. Check the link or go back to the overview.',
      }
    }
    return {
      title: 'This page could not load',
      description: 'The server returned an error. Reload the page, or go back to the overview.',
      details: `HTTP ${error.status}`,
    }
  }
  return {
    title: 'This page stopped working',
    description:
      'Something unexpected went wrong while showing this page. Reload to try again. Your data is not affected.',
    details: import.meta.env.DEV && error instanceof Error ? error.message : undefined,
  }
}

/** Route-level error screen. The shell stays in place when a page fails. */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const { title, description, details } = describe(error)
  useDocumentTitle(title)

  return (
    <div className="px-4 py-8">
      <ErrorState
        headingLevel={1}
        title={title}
        description={description}
        details={details}
        onRetry={() => window.location.reload()}
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
