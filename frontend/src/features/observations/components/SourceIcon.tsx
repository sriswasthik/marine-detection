import { Drone, Satellite } from 'lucide-react'
import type { ObservationSource } from '../types'

/** Decorative source icon. Always pair it with text. */
export function SourceIcon({
  source,
  className,
}: {
  source: ObservationSource
  className?: string
}) {
  const Icon = source === 'drone' ? Drone : Satellite
  return <Icon aria-hidden className={className} />
}
