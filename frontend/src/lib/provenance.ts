import type { MaridaPatch, Observation } from '@/features/observations/types'

/**
 * Where an observation's figures come from, for the labels frontend/CLAUDE.md rule 5 requires.
 *   model:  real model output on a MARIDA patch, labelled "Model output on MARIDA patch <id>".
 *   sample: synthetic sample data, labelled "Sample data".
 *   live:   a result from the processing service; no label.
 */
export type Provenance =
  | { kind: 'model'; label: string; patch: MaridaPatch; note: string | null }
  | { kind: 'sample'; label: 'Sample data' }
  | { kind: 'live'; label: null }

export const TRAINING_SPLIT_NOTE =
  'From the training split: the model saw this patch while learning, so results may look better than on new imagery.'

export function observationProvenance(
  observation: Pick<Observation, 'maridaPatch'>,
  mockMode: boolean,
): Provenance {
  const patch = observation.maridaPatch
  if (patch) {
    return {
      kind: 'model',
      label: `Model output on MARIDA patch ${patch.id}`,
      patch,
      note: patch.split === 'train' ? TRAINING_SPLIT_NOTE : null,
    }
  }
  return mockMode ? { kind: 'sample', label: 'Sample data' } : { kind: 'live', label: null }
}
