import { ChevronDown, CloudOff } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { pathForObservation } from '@/lib/routes'
import { DropdownMenu, Skeleton, Tag, type DropdownMenuEntry } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, formatInteger } from '@/lib/format'
import {
  useCurrentObservationId,
  useCurrentObservationSelection,
} from '../currentObservationContext'
import { useObservations } from '../hooks'
import { SOURCE_LABELS } from '../labels'
import type { ObservationSummary } from '../types'
import { ObservationGlyphById } from './ObservationGlyphById'

function detectionsLabel(observation: ObservationSummary): string {
  if (observation.detectionCount === 0) return 'No debris detected'
  return `${formatInteger(observation.detectionCount)} ${observation.detectionCount === 1 ? 'detection' : 'detections'}`
}

export interface ObservationChipProps {
  /** Stretch to the container, for the mobile menu. */
  fullWidth?: boolean
  align?: 'start' | 'end'
  className?: string
}

/**
 * The observation in view, with a menu to switch. The current one comes from the URL path,
 * else the session selection, else the most recent observation. Picking one remembers it and,
 * on an observation page, opens the same page for the new observation.
 */
export function ObservationChip({
  fullWidth = false,
  align = 'end',
  className,
}: ObservationChipProps) {
  const { data, isPending, isError } = useObservations()
  const location = useLocation()
  const navigate = useNavigate()
  const { setSelectedId } = useCurrentObservationSelection()
  const currentId = useCurrentObservationId(data?.data)

  if (isPending) {
    return <Skeleton className={cn('h-8', fullWidth ? 'w-full' : 'w-48', className)} />
  }
  if (isError) {
    return (
      <Tag icon={<CloudOff aria-hidden />} className={className}>
        Observations unavailable
      </Tag>
    )
  }

  const observations = data.data
  const current = observations.find((o) => o.id === currentId) ?? observations[0]
  if (!current) {
    return <Tag className={className}>No observations yet</Tag>
  }

  const items: DropdownMenuEntry[] = [
    { type: 'label', id: 'heading', label: 'Switch observation' },
    ...observations.map((observation): DropdownMenuEntry => ({
      id: observation.id,
      label: observation.region,
      description: `${formatDate(observation.capturedAt)} · ${SOURCE_LABELS[observation.source]} · ${detectionsLabel(observation)}`,
      icon: <ObservationGlyphById id={observation.id} size={16} />,
      checked: observation.id === current.id,
      onSelect: () => {
        setSelectedId(observation.id)
        const path = pathForObservation(location.pathname, observation.id)
        if (path) navigate(path)
      },
    })),
  ]

  return (
    <DropdownMenu
      align={align}
      className={cn(fullWidth && 'flex w-full', className)}
      menuClassName={cn('w-80 max-w-[calc(100vw-2rem)]', fullWidth && 'w-full')}
      items={items}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={cn(
            'inline-flex h-8 min-w-0 items-center gap-2 rounded-control px-2 text-small text-ink',
            'transition-colors duration-[120ms] ease-out hover:bg-ink/5 aria-expanded:bg-ink/5',
            fullWidth ? 'w-full border border-hairline' : 'max-w-56 xl:max-w-80',
          )}
        >
          <ObservationGlyphById id={current.id} size={16} />
          <span className="sr-only">Current observation:</span>
          <span className="min-w-0 flex-1 truncate text-left font-medium">{current.region}</span>
          <span className="sr-only">, {SOURCE_LABELS[current.source]},</span>
          <span className="data shrink-0 text-ink-2">{formatDate(current.capturedAt)}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-2" />
        </button>
      )}
    />
  )
}
