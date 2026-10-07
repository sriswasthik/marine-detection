/**
 * Six synthetic sample observations. Region names are real places; every figure is generated.
 * The UI must label these "Sample data".
 */
import type { Observation, ObservationSource } from '../types'
import { generateObservation, type SceneSpec } from './generator'
import type { MockScenario } from './scenario'

export const SAMPLE_IDS = {
  ennore: 'obs-ennore-20261003',
  mahim: 'obs-mahim-20260929',
  vembanad: 'obs-vembanad-20260923',
  mannar: 'obs-mannar-20260918',
  visakhapatnam: 'obs-visakhapatnam-20260911',
  sundarbans: 'obs-sundarbans-20260831',
} as const

/** The scene the demo opens on. */
export const HERO_SAMPLE_ID = SAMPLE_IDS.ennore

export const SAMPLE_SCENE_SPECS: readonly SceneSpec[] = [
  {
    id: SAMPLE_IDS.ennore,
    seed: 'ennore-coast-v1',
    name: 'Ennore coast',
    region: 'Ennore coast, Bay of Bengal',
    source: 'satellite',
    capturedAt: '2026-10-03T05:06:41Z',
    status: 'completed',
    crs: 'EPSG:32644',
    center: { lat: 13.22, lng: 80.368 },
    sizePx: [600, 450],
    resolutionM: 10,
    driftBearingDeg: 200,
    clusters: [
      {
        at: [0.24, 0.68],
        spreadPx: [16, 6],
        count: 16,
        medianAreaPx: 28,
        maxAreaPx: 150,
        intensity: 0.9,
      },
      {
        at: [0.56, 0.3],
        spreadPx: [18, 6],
        count: 17,
        medianAreaPx: 30,
        maxAreaPx: 150,
        intensity: 0.95,
      },
      {
        at: [0.82, 0.74],
        spreadPx: [15, 5],
        count: 14,
        medianAreaPx: 26,
        maxAreaPx: 140,
        intensity: 0.85,
      },
      {
        at: [0.14, 0.2],
        spreadPx: [40, 16],
        count: 4,
        medianAreaPx: 6,
        maxAreaPx: 18,
        intensity: 0.4,
      },
    ],
    tail: { count: 10, medianAreaPx: 4, maxAreaPx: 12 },
    cloudCoveragePercent: 6,
    processing: { delaySeconds: 3 * 3600 + 14 * 60, durationSeconds: 47 },
  },
  {
    id: SAMPLE_IDS.mahim,
    seed: 'mahim-bay-v1',
    name: 'Mahim Bay',
    region: 'Mahim Bay, Mumbai',
    source: 'drone',
    capturedAt: '2026-09-29T04:12:00Z',
    status: 'completed',
    crs: 'EPSG:32643',
    center: { lat: 19.043, lng: 72.832 },
    sizePx: [1200, 800],
    resolutionM: 0.1,
    driftBearingDeg: 235,
    clusters: [
      {
        at: [0.33, 0.56],
        spreadPx: [55, 18],
        count: 9,
        medianAreaPx: 10,
        maxAreaPx: 30,
        intensity: 0.6,
      },
      {
        at: [0.7, 0.38],
        spreadPx: [50, 16],
        count: 8,
        medianAreaPx: 9,
        maxAreaPx: 30,
        intensity: 0.55,
      },
    ],
    tail: { count: 8, medianAreaPx: 4, maxAreaPx: 10 },
    cloudCoveragePercent: 0,
    processing: { delaySeconds: 40 * 60, durationSeconds: 112 },
  },
  {
    id: SAMPLE_IDS.vembanad,
    seed: 'vembanad-lake-v1',
    name: 'Vembanad Lake',
    region: 'Vembanad Lake, Kochi',
    source: 'satellite',
    capturedAt: '2026-09-23T05:16:21Z',
    status: 'completed',
    crs: 'EPSG:32643',
    center: { lat: 9.89, lng: 76.315 },
    sizePx: [250, 350],
    resolutionM: 10,
    driftBearingDeg: 170,
    clusters: [
      {
        at: [0.5, 0.5],
        spreadPx: [70, 24],
        count: 8,
        medianAreaPx: 4,
        maxAreaPx: 9,
        intensity: 0.3,
      },
    ],
    tail: { count: 6, medianAreaPx: 3, maxAreaPx: 8 },
    cloudCoveragePercent: 14,
    processing: { delaySeconds: 2 * 3600 + 51 * 60, durationSeconds: 31 },
  },
  {
    id: SAMPLE_IDS.mannar,
    seed: 'gulf-of-mannar-v1',
    name: 'Gulf of Mannar',
    region: 'Gulf of Mannar',
    source: 'satellite',
    capturedAt: '2026-09-18T05:11:09Z',
    status: 'completed',
    crs: 'EPSG:32644',
    center: { lat: 9.05, lng: 79.15 },
    sizePx: [500, 400],
    resolutionM: 10,
    driftBearingDeg: 90,
    clusters: [],
    tail: { count: 0, medianAreaPx: 4, maxAreaPx: 10 },
    cloudCoveragePercent: 4,
    processing: { delaySeconds: 3 * 3600 + 2 * 60, durationSeconds: 39 },
  },
  {
    id: SAMPLE_IDS.visakhapatnam,
    seed: 'visakhapatnam-coast-v1',
    name: 'Visakhapatnam coast',
    region: 'Visakhapatnam coast, Bay of Bengal',
    source: 'satellite',
    capturedAt: '2026-09-11T04:56:33Z',
    status: 'completed',
    crs: 'EPSG:32644',
    center: { lat: 17.675, lng: 83.32 },
    sizePx: [500, 400],
    resolutionM: 10,
    driftBearingDeg: 40,
    clusters: [
      {
        at: [0.4, 0.5],
        spreadPx: [30, 9],
        count: 10,
        medianAreaPx: 12,
        maxAreaPx: 60,
        intensity: 0.5,
      },
      {
        at: [0.72, 0.28],
        spreadPx: [25, 8],
        count: 7,
        medianAreaPx: 9,
        maxAreaPx: 40,
        intensity: 0.4,
      },
    ],
    tail: { count: 12, medianAreaPx: 4, maxAreaPx: 10 },
    confidence: { shift: -0.15, outlierRate: 0.3 },
    cloudCoveragePercent: 41,
    warnings: ['LOW_CONFIDENCE', 'HIGH_CLOUD'],
    processing: { delaySeconds: 4 * 3600 + 8 * 60, durationSeconds: 44 },
  },
  {
    id: SAMPLE_IDS.sundarbans,
    seed: 'sundarbans-delta-v1',
    name: 'Sundarbans delta',
    region: 'Sundarbans delta, Bay of Bengal',
    source: 'satellite',
    capturedAt: '2026-08-31T04:36:52Z',
    status: 'partial',
    crs: null,
    center: { lat: 21.62, lng: 88.85 },
    sizePx: [500, 400],
    resolutionM: 10,
    driftBearingDeg: 180,
    clusters: [
      {
        at: [0.5, 0.6],
        spreadPx: [28, 8],
        count: 12,
        medianAreaPx: 18,
        maxAreaPx: 120,
        intensity: 0.75,
      },
    ],
    tail: { count: 8, medianAreaPx: 4, maxAreaPx: 10 },
    cloudCoveragePercent: 18,
    warnings: ['PARTIAL_GEOREF'],
    processing: { delaySeconds: 5 * 3600 + 21 * 60, durationSeconds: 52 },
  },
]

let cache: Observation[] | null = null

/** All samples, newest first. Generated once on first use; deterministic. */
export function getSampleObservations(): Observation[] {
  cache ??= SAMPLE_SCENE_SPECS.map(generateObservation).sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  )
  return cache
}

export function getSampleObservation(id: string): Observation | undefined {
  return getSampleObservations().find((observation) => observation.id === id)
}

const SCENARIO_SAMPLES: Partial<Record<MockScenario, string>> = {
  nodebris: SAMPLE_IDS.mannar,
  lowconf: SAMPLE_IDS.visakhapatnam,
  partial: SAMPLE_IDS.sundarbans,
}

/** File name keywords that select a specific sample, so a demo upload is predictable. */
const FILE_NAME_KEYWORDS: readonly [keyword: string, sampleId: string][] = [
  ['ennore', SAMPLE_IDS.ennore],
  ['mahim', SAMPLE_IDS.mahim],
  ['vembanad', SAMPLE_IDS.vembanad],
  ['kochi', SAMPLE_IDS.vembanad],
  ['mannar', SAMPLE_IDS.mannar],
  ['visakhapatnam', SAMPLE_IDS.visakhapatnam],
  ['vizag', SAMPLE_IDS.visakhapatnam],
  ['sundarbans', SAMPLE_IDS.sundarbans],
]

/**
 * Which sample a simulated upload resolves to, in order of precedence:
 * the scenario (nodebris, lowconf, partial), a keyword in the file name,
 * the drone sample for drone uploads, otherwise the hero scene.
 */
export function pickSampleIdForUpload(input: {
  fileName: string
  source: ObservationSource
  scenario: MockScenario
}): string {
  const fromScenario = SCENARIO_SAMPLES[input.scenario]
  if (fromScenario) return fromScenario
  const name = input.fileName.toLowerCase()
  const match = FILE_NAME_KEYWORDS.find(([keyword]) => name.includes(keyword))
  if (match) return match[1]
  if (input.source === 'drone') return SAMPLE_IDS.mahim
  return HERO_SAMPLE_ID
}
