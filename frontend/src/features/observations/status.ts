import { toAppError } from '@/lib/errors/appError'
import type { Observation } from './types'

/** Completed and partial observations have results to show; the others do not (yet). */
export function hasResult(observation: Pick<Observation, 'status'>): boolean {
  return observation.status === 'completed' || observation.status === 'partial'
}

/** True when a load failed because the observation does not exist. */
export function isNotFound(error: unknown): boolean {
  return toAppError(error).code === 'NOT_FOUND'
}
