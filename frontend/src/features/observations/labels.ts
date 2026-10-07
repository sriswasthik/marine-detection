import type { ObservationSource } from './types'

export const SOURCE_LABELS: Readonly<Record<ObservationSource, string>> = {
  satellite: 'Satellite',
  drone: 'Drone',
}
