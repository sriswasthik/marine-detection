import { describe, expect, it } from 'vitest'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import { draftReducer, initialDraft, type AnalyzeDraft } from './draft'
import { sampleSelection } from './samples'
import type { FileInspection } from './validate'

const now = new Date(2026, 9, 7, 9, 30)
const file = (name = 'scene.tif') => new File(['x'], name, { type: 'image/tiff' })
const facts = (f: File) => ({ name: f.name, size: f.size, type: f.type })
const inspection = (patch: Partial<FileInspection> = {}): FileInspection => ({
  kind: 'geotiff',
  width: 1000,
  height: 800,
  bands: 11,
  georeferenced: true,
  embeddedBounds: { north: 13.24, south: 13.2, east: 80.39, west: 80.34 },
  epsg: 32644,
  resolutionM: 10,
  previewUrl: null,
  readError: null,
  ...patch,
})

describe('draftReducer', () => {
  it('starts empty with the capture time set to now', () => {
    const draft = initialDraft(now)
    expect(draft).toMatchObject({
      file: null,
      region: '',
      source: 'satellite',
      capturedAt: '2026-10-07T09:30',
    })
  })

  it('fills bounds read from the file, but never over typed bounds', () => {
    const chosen = file()
    let draft = draftReducer(initialDraft(now), {
      type: 'fileSelected',
      file: chosen,
      facts: facts(chosen),
    })
    expect(draft.file).toMatchObject({ inspecting: true })
    draft = draftReducer(draft, {
      type: 'inspected',
      file: chosen,
      inspection: inspection(),
      regionHint: 'hint',
    })
    expect(draft.bounds.north).toBe('13.24')
    expect(draft.boundsOrigin).toBe('file')
    expect(draft.regionHint).toBe('hint')

    const typed = draftReducer(initialDraft(now), {
      type: 'boundsChanged',
      field: 'north',
      value: '20',
    })
    const next = file('b.tif')
    let withTyped = draftReducer(typed, { type: 'fileSelected', file: next, facts: facts(next) })
    withTyped = draftReducer(withTyped, {
      type: 'inspected',
      file: next,
      inspection: inspection(),
      regionHint: null,
    })
    expect(withTyped.bounds.north).toBe('20')
    expect(withTyped.boundsOrigin).toBe('manual')
  })

  it('ignores a late read for a file that was replaced', () => {
    const first = file('a.tif')
    const second = file('b.tif')
    let draft = draftReducer(initialDraft(now), {
      type: 'fileSelected',
      file: first,
      facts: facts(first),
    })
    draft = draftReducer(draft, { type: 'fileSelected', file: second, facts: facts(second) })
    const after = draftReducer(draft, {
      type: 'inspected',
      file: first,
      inspection: inspection(),
      regionHint: null,
    })
    expect(after).toBe(draft)
  })

  it('drops file-read bounds when the file changes, keeping the metadata', () => {
    const chosen = file()
    let draft: AnalyzeDraft = draftReducer(initialDraft(now), {
      type: 'regionChanged',
      region: 'Ennore',
    })
    draft = draftReducer(draft, { type: 'fileSelected', file: chosen, facts: facts(chosen) })
    draft = draftReducer(draft, {
      type: 'inspected',
      file: chosen,
      inspection: inspection(),
      regionHint: null,
    })
    draft = draftReducer(draft, { type: 'fileCleared' })
    expect(draft.file).toBeNull()
    expect(draft.bounds.north).toBe('')
    expect(draft.region).toBe('Ennore')
  })

  it('fills everything from a sample scene', () => {
    const hero = getSampleObservation(SAMPLE_IDS.ennore)
    if (!hero) throw new Error('missing hero')
    const draft = draftReducer(initialDraft(now), {
      type: 'sampleSelected',
      sample: sampleSelection(hero),
    })
    expect(draft.file).toMatchObject({ kind: 'sample', sampleId: hero.id })
    expect(draft.file?.facts.name).toContain('ennore')
    expect(draft.region).toBe(hero.region)
    expect(draft.source).toBe('satellite')
    expect(Number(draft.bounds.north)).toBeCloseTo(hero.bounds?.north ?? 0, 5)
    expect(draft.file?.inspection?.width).toBeGreaterThan(500)
  })

  it('keeps every field for a retry and only clears on reset', () => {
    const chosen = file()
    let draft = draftReducer(initialDraft(now), {
      type: 'fileSelected',
      file: chosen,
      facts: facts(chosen),
    })
    draft = draftReducer(draft, { type: 'regionChanged', region: 'Mahim' })
    draft = draftReducer(draft, { type: 'sourceChanged', source: 'drone' })
    // A run (and its retry) never dispatches draft actions, so the draft is untouched.
    expect(draft).toMatchObject({ region: 'Mahim', source: 'drone' })
    expect(draft.file?.file).toBe(chosen)
    expect(draftReducer(draft, { type: 'reset', now })).toEqual(initialDraft(now))
  })
})
