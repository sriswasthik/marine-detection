import { ChevronDown, CloudOff } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { observationIdFromPath, pathForObservation } from '@/lib/routes'
import { Badge, DropdownMenu, Skeleton, type DropdownMenuEntry } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, formatInteger } from '@/lib/format'
import { useObservations } from '../hooks'
import { SOURCE_LABELS } from '../labels'
import type { ObservationSummary } from '../types'
import { SourceIcon } from './SourceIcon'

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
 * The observation in view, with a menu to switch. The current one comes from the URL,
 * or is the most recent observation when the page is not about a specific one.
 */
export function ObservationChip({
  fullWidth = false,
  align = 'end',
  className,
}: ObservationChipProps) {
  const { data, isPending, isError } = useObservations()
  const location = useLocation()
  const navigate = useNavigate()

  if (isPending) {
    return <Skeleton className={cn('h-8', fullWidth ? 'w-full' : 'w-48', className)} />
  }
  if (isError) {
    return (
      <Badge icon={<CloudOff aria-hidden />} className={className}>
        Observations unavailable
      </Badge>
    )
  }

  const observations = data.data
  const routeId = observationIdFromPath(location.pathname)
  const current = observations.find((o) => o.id === routeId) ?? observations[0]
  if (!current) {
    return <Badge className={className}>No observations yet</Badge>
  }

  const items: DropdownMenuEntry[] = [
    { type: 'label', id: 'heading', label: 'Switch observation' },
    ...observations.map((observation): DropdownMenuEntry => ({
      id: observation.id,
      label: observation.region,
      description: `${formatDate(observation.capturedAt)} · ${SOURCE_LABELS[observation.source]} · ${detectionsLabel(observation)}`,
      icon: <SourceIcon source={observation.source} />,
      checked: observation.id === current.id,
      onSelect: () => navigate(pathForObservation(location.pathname, observation.id)),
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
            'inline-flex h-8 min-w-0 items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-small text-ink',
            'transition-colors duration-150 ease-out hover:border-border-strong hover:bg-bg aria-expanded:bg-bg',
            fullWidth ? 'w-full' : 'max-w-56 xl:max-w-[22rem]',
          )}
        >
          <SourceIcon source={current.source} className="size-4 shrink-0 text-ink-muted" />
          <span className="sr-only">Current observation:</span>
          <span className="min-w-0 flex-1 truncate text-left font-medium">{current.region}</span>
          <span className="sr-only">, {SOURCE_LABELS[current.source]},</span>
          <span className="num shrink-0 text-ink-muted">{formatDate(current.capturedAt)}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-muted" />
        </button>
      )}
    />
  )
}
