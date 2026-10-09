import { ArrowLink, EmptyState } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="mx-auto w-full max-w-page px-4 py-8 sm:px-6 lg:px-8">
      <EmptyState
        headingLevel={1}
        title="Page not found"
        description="The address does not match any page. Check the link or go back to the overview."
        action={<ArrowLink to="/">Go to overview</ArrowLink>}
      />
    </div>
  )
}
