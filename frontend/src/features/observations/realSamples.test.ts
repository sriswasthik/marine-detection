/**
 * The Python pipeline's output against this app's zod schema.
 *
 * Checks every scene in public/samples (written by backend/scripts/export_samples.py), including
 * that the service's density levels and hotspots follow this app's rules. With OBSERVATION_JSON
 * set to a file path, checks that one file instead; backend/tests runs it that way.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeObservation } from '@/lib/analysis'
import { DENSITY_THRESHOLDS, gridCellSizeForResolution } from '@/lib/config'
import { levelForCoverage, observationDensityLevel } from '@/lib/density'
import { findHotspots } from '@/lib/hotspots'
import { createMockApi } from './api/mockApi'
import { createRealSampleLoader } from './mock/realSamples'
import { parseObservation } from './schemas'
import type { Observation } from './types'

// Vitest runs from the frontend folder.
const PUBLIC_DIR = join(process.cwd(), 'public')
const SAMPLES_DIR = join(PUBLIC_DIR, 'samples')
const INDEX = join(SAMPLES_DIR, 'index.json')
const single = process.env.OBSERVATION_JSON
/** An exported scene with High hotspots (backend/tests/test_density.py checks it too). */
const HOTSPOT_SCENE = 'S2_22-12-20_18QYF_0'

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf-8')) as unknown

function sampleIds(): string[] {
  const index = readJson(INDEX) as { samples: { id: string }[] }
  return index.samples.map((s) => s.id)
}

function expectValid(raw: unknown) {
  const result = parseObservation(raw)
  expect(result.issues).toEqual([])
  expect(result.status).toBe('valid')
  const observation = result.data
  if (!observation) throw new Error('No data')
  expect(observation.densityLevel === null).toBe(observation.detections.length === 0)
  expect(observation.maridaPatch?.id).toBe(observation.id)
  expectServiceDensityFollowsTheAppRules(observation)
  return observation
}

/**
 * The pipeline grades density and ranks hotspots itself (backend/pipeline.py compute_density).
 * Its thresholds, cell size, levels and hotspots must be the ones this app's rules give for the
 * same cells, and the app must show them as sent.
 */
function expectServiceDensityFollowsTheAppRules(observation: Observation) {
  const service = observation.densityGrid
  if (!service || !observation.hotspots) throw new Error('No service density grid or hotspots')
  expect(service.thresholds).toEqual(DENSITY_THRESHOLDS)
  expect(service.cellSizeM).toBe(gridCellSizeForResolution(observation.resolutionM))

  const analysis = analyzeObservation(observation)
  const grid = analysis.grid
  if (!grid) throw new Error('No grid')
  expect(grid.source).toBe('service')
  expect(analysis.hotspots).toBe(observation.hotspots)

  for (const cell of service.cells) {
    expect(cell.level).toBe(levelForCoverage((cell.debrisAreaM2 / cell.areaM2) * 100))
  }
  // Detection levels: the cell holding most of each detection's area.
  for (const detection of observation.detections) {
    expect(detection.densityLevel).toBe(grid.detectionLevels[detection.id])
  }
  expect(observation.densityLevel).toBe(observationDensityLevel(grid))

  // Hotspots: findHotspots on the same cells gives the same groups, levels and ranking.
  const recomputed = findHotspots(grid, observation.detections)
  expect(
    recomputed.map(({ id, rank, level, cellIds, detectionIds }) => ({
      id,
      rank,
      level,
      cellIds,
      detectionIds,
    })),
  ).toEqual(
    observation.hotspots.map(({ id, rank, level, cellIds, detectionIds }) => ({
      id,
      rank,
      level,
      cellIds,
      detectionIds,
    })),
  )
  recomputed.forEach((hotspot, index) => {
    const sent = observation.hotspots?.[index]
    if (!sent) throw new Error('Missing hotspot')
    expect(sent.totalAreaM2).toBeCloseTo(hotspot.totalAreaM2, 2)
    expect(sent.meanConfidence).toBeCloseTo(hotspot.meanConfidence, 4)
    expect(sent.priorityScore).toBeCloseTo(hotspot.priorityScore, 2)
    expect(sent.centroid.lat).toBeCloseTo(hotspot.centroid.lat, 6)
    expect(sent.centroid.lng).toBeCloseTo(hotspot.centroid.lng, 6)
  })
}

describe.runIf(single)('pipeline output file', () => {
  it('validates against the observation schema', () => {
    expectValid(readJson(single ?? ''))
  })
})

describe.runIf(!single && existsSync(INDEX))('exported samples in public/samples', () => {
  it('every scene validates and its image files exist', () => {
    const ids = sampleIds()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const observation = expectValid(readJson(join(SAMPLES_DIR, id, 'observation.json')))
      for (const url of [observation.previewUrl, observation.maskUrl, observation.referenceUrl]) {
        if (url) expect(existsSync(join(PUBLIC_DIR, url))).toBe(true)
      }
    }
  })

  it("an uploaded real scene keeps the service grid and hotspots, under the upload's ids", async () => {
    const real = expectValid(readJson(join(SAMPLES_DIR, HOTSPOT_SCENE, 'observation.json')))
    if (!real.hotspots?.length) throw new Error(`Expected hotspots in ${HOTSPOT_SCENE}`)
    let clock = 0
    const api = createMockApi({
      latencyMs: [0, 0],
      pollLatencyMs: [0, 0],
      pipelineDurationMs: 20,
      now: () => clock,
      scenario: () => 'success',
      realSamples: () => Promise.resolve([real]),
    })
    const file = new File(['x'], `${HOTSPOT_SCENE}.tif`, { type: 'image/tiff' })
    const input = {
      file,
      source: 'satellite' as const,
      region: '',
      capturedAt: '2020-12-22T12:00:00Z',
    }
    const { jobId } = await api.createObservation(input)
    clock = 1000 // past the simulated pipeline
    const job = await api.getJob(jobId)
    expect(job.status).toBe('completed')
    const { data } = await api.getObservation(job.observationId ?? '')

    const ids = new Set(data.detections.map((d) => d.id))
    expect([...ids].every((id) => id.startsWith(data.id))).toBe(true)
    const inCells = data.densityGrid?.cells.flatMap((c) => Object.keys(c.detectionAreasM2)) ?? []
    expect(new Set(inCells)).toEqual(ids)
    expect(data.hotspots?.flatMap((h) => h.detectionIds).every((id) => ids.has(id))).toBe(true)
    const analysis = analyzeObservation(data)
    expect(analysis.grid?.source).toBe('service')
    expect(analysis.hotspots).toBe(data.hotspots)
    expect(analysis.hotspots.map((h) => h.cellIds)).toEqual(real.hotspots.map((h) => h.cellIds))

    const summary = (await api.listObservations()).data.find((o) => o.id === data.id)
    expect(summary && 'densityGrid' in summary).toBe(false)
    expect(summary?.hotspots).toHaveLength(real.hotspots.length)
  })

  it('the mock loader reads them all', async () => {
    const fakeFetch = (input: RequestInfo | URL) => {
      const path = join(PUBLIC_DIR, String(input))
      return Promise.resolve(
        existsSync(path)
          ? new Response(readFileSync(path, 'utf-8'), { status: 200 })
          : new Response('', { status: 404 }),
      )
    }
    const load = createRealSampleLoader(fakeFetch as typeof fetch, '/samples/')
    const observations = await load()
    expect(observations.map((o) => o.id)).toEqual(sampleIds())
    expect(await load()).toBe(observations)
  })
})
