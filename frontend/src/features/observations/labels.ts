import type { TagTone } from '@/components/ui'
import type { ObservationSource, ObservationStatus } from './types'

export const SOURCE_LABELS: Readonly<Record<ObservationSource, string>> = {
  satellite: 'Satellite',
  drone: 'Drone',
}

export const STATUS_LABELS: Readonly<Record<ObservationStatus, string>> = {
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  partial: 'Partial',
  failed: 'Failed',
}

export const STATUS_TONES: Readonly<Record<ObservationStatus, TagTone>> = {
  queued: 'neutral',
  processing: 'accent',
  completed: 'success',
  partial: 'warning',
  failed: 'danger',
}
