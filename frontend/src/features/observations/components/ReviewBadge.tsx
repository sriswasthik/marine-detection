import { CheckCircle2, HelpCircle, XCircle, Clock } from 'lucide-react'
import type { AnalystReviewState } from '../types'
import { Tag, type TagTone } from '@/components/ui/Tag'

export interface ReviewBadgeProps {
  status?: AnalystReviewState | null
  className?: string
}

const REVIEW_CONFIG: Record<
  AnalystReviewState,
  { label: string; tone: TagTone; icon: typeof CheckCircle2 }
> = {
  unreviewed: { label: 'Unreviewed', tone: 'neutral', icon: Clock },
  confirmed: { label: 'Confirmed Debris', tone: 'success', icon: CheckCircle2 },
  false_positive: { label: 'False Positive', tone: 'danger', icon: XCircle },
  uncertain: { label: 'Uncertain', tone: 'warning', icon: HelpCircle },
}

export function ReviewBadge({ status = 'unreviewed', className }: ReviewBadgeProps) {
  const currentStatus = status || 'unreviewed'
  const config = REVIEW_CONFIG[currentStatus]
  const Icon = config.icon

  return (
    <Tag
      tone={config.tone}
      icon={<Icon className="size-3" />}
      className={className}
    >
      {config.label}
    </Tag>
  )
}
