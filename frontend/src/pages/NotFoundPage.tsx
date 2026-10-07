import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonStyles, EmptyState } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="px-4 py-8">
      <EmptyState
        headingLevel={1}
        icon={<SearchX />}
        title="Page not found"
        description="The address does not match any page. Check the link or go back to the overview."
        action={
          <Link to="/" className={buttonStyles({ variant: 'secondary' })}>
            Go to overview
          </Link>
        }
      />
    </div>
  )
}
