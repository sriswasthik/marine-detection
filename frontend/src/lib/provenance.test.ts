import { describe, expect, it } from 'vitest'
import { observationProvenance, TRAINING_SPLIT_NOTE } from './provenance'

const patch = {
  id: 'S2_22-12-20_18QYF_0',
  tile: '18QYF',
  date: '2020-12-22',
  split: 'test' as const,
}

describe('observationProvenance', () => {
  it('labels real model output with its MARIDA patch, in any mode', () => {
    for (const mock of [true, false]) {
      const result = observationProvenance({ maridaPatch: patch }, mock)
      expect(result).toMatchObject({
        kind: 'model',
        label: 'Model output on MARIDA patch S2_22-12-20_18QYF_0',
        note: null,
      })
    }
  })

  it('notes when the patch is from the training split', () => {
    const result = observationProvenance({ maridaPatch: { ...patch, split: 'train' } }, true)
    expect(result.kind === 'model' && result.note).toBe(TRAINING_SPLIT_NOTE)
  })

  it('labels everything else "Sample data" in mock mode and nothing when live', () => {
    expect(observationProvenance({}, true)).toEqual({ kind: 'sample', label: 'Sample data' })
    expect(observationProvenance({}, false)).toEqual({ kind: 'live', label: null })
  })
})
