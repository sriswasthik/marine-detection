import { ArrowLink } from '@/components/ui'
import { cn } from '@/lib/cn'
import { nextStepFor, type PageId } from '@/lib/navigation'

/**
 * The end of every page: one text link with an arrow to the logical next screen, along Overview,
 * Analyze, Map, Observation detail and Report.
 */
export function NextStep({
  page,
  observationId,
  className,
}: {
  page: PageId
  observationId: string | null
  className?: string
}) {
  const step = nextStepFor(page, observationId)
  return (
    <nav aria-label="Next step" className={cn('border-t border-rule pt-4', className)}>
      <ArrowLink to={step.to}>{step.label}</ArrowLink>
    </nav>
  )
}
