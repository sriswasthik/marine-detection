import type { ObservationSource } from '@/features/observations/types'
import { toDateTimeLocalValue } from '@/lib/datetime'
import type { SampleSelection } from './samples'
import {
  boundsToInput,
  EMPTY_BOUNDS_INPUT,
  type BoundsInput,
  type FileFacts,
  type FileInspection,
} from './validate'

export type DraftFile =
  | {
      kind: 'upload'
      file: File
      facts: FileFacts
      inspection: FileInspection | null
      inspecting: boolean
    }
  | {
      kind: 'sample'
      sampleId: string
      file: File
      facts: FileFacts
      inspection: FileInspection
      inspecting: false
    }

/** Everything the user has entered. Lives above the routes so in-app navigation keeps it. */
export interface AnalyzeDraft {
  file: DraftFile | null
  source: ObservationSource
  region: string
  /** datetime-local value, local time. */
  capturedAt: string
  bounds: BoundsInput
  /** Where the bounds came from; file-read bounds are replaced when the file changes. */
  boundsOrigin: 'empty' | 'file' | 'manual'
  /** Shown under the region field, from the file's position. */
  regionHint: string | null
}

export type DraftAction =
  | { type: 'fileSelected'; file: File; facts: FileFacts }
  | { type: 'inspected'; file: File; inspection: FileInspection; regionHint: string | null }
  | { type: 'sampleSelected'; sample: SampleSelection }
  | { type: 'fileCleared' }
  | { type: 'sourceChanged'; source: ObservationSource }
  | { type: 'regionChanged'; region: string }
  | { type: 'capturedAtChanged'; capturedAt: string }
  | { type: 'boundsChanged'; field: keyof BoundsInput; value: string }
  | { type: 'reset'; now: Date }

export function initialDraft(now: Date): AnalyzeDraft {
  return {
    file: null,
    source: 'satellite',
    region: '',
    capturedAt: toDateTimeLocalValue(now),
    bounds: EMPTY_BOUNDS_INPUT,
    boundsOrigin: 'empty',
    regionHint: null,
  }
}

/** Bounds read from a previous file must not stick to the next one; typed bounds stay. */
function withoutFileBounds(draft: AnalyzeDraft): AnalyzeDraft {
  return draft.boundsOrigin === 'file'
    ? { ...draft, bounds: EMPTY_BOUNDS_INPUT, boundsOrigin: 'empty' }
    : draft
}

export function draftReducer(draft: AnalyzeDraft, action: DraftAction): AnalyzeDraft {
  switch (action.type) {
    case 'fileSelected':
      return {
        ...withoutFileBounds(draft),
        regionHint: null,
        file: {
          kind: 'upload',
          file: action.file,
          facts: action.facts,
          inspection: null,
          inspecting: true,
        },
      }
    case 'inspected': {
      // A slow read for a file that has since been replaced is ignored.
      if (draft.file?.kind !== 'upload' || draft.file.file !== action.file) return draft
      const embedded = action.inspection.embeddedBounds
      const fillBounds = embedded !== null && draft.boundsOrigin !== 'manual'
      return {
        ...draft,
        file: { ...draft.file, inspection: action.inspection, inspecting: false },
        bounds: fillBounds ? boundsToInput(embedded) : draft.bounds,
        boundsOrigin: fillBounds ? 'file' : draft.boundsOrigin,
        regionHint: action.regionHint,
      }
    }
    case 'sampleSelected':
      return {
        ...draft,
        file: {
          kind: 'sample',
          sampleId: action.sample.sampleId,
          file: action.sample.file,
          facts: action.sample.facts,
          inspection: action.sample.inspection,
          inspecting: false,
        },
        source: action.sample.source,
        region: action.sample.region,
        capturedAt: action.sample.capturedAt,
        bounds: action.sample.bounds,
        boundsOrigin: 'file',
        regionHint: null,
      }
    case 'fileCleared':
      return { ...withoutFileBounds(draft), file: null, regionHint: null }
    case 'sourceChanged':
      return { ...draft, source: action.source }
    case 'regionChanged':
      return { ...draft, region: action.region }
    case 'capturedAtChanged':
      return { ...draft, capturedAt: action.capturedAt }
    case 'boundsChanged':
      return {
        ...draft,
        bounds: { ...draft.bounds, [action.field]: action.value },
        boundsOrigin: 'manual',
      }
    case 'reset':
      return initialDraft(action.now)
  }
}
