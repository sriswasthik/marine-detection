/**
 * Real model output on MARIDA patches, exported by backend/scripts/export_samples.py into
 * public/samples: index.json lists the ids, and each <id>/observation.json is one Observation.
 *
 * The files are fetched once, validated with the same zod schema the live service goes through
 * (which also fills in density levels; the pipeline leaves them to src/lib/density.ts), and kept
 * in memory. Missing or unreadable files are not an error: the mock then serves the synthetic
 * samples alone. The UI labels these "Model output on MARIDA patch <id>", not "Sample data".
 */
import { z } from 'zod'
import { parseObservation } from '../schemas'
import type { Observation } from '../types'

const IndexSchema = z.object({
  samples: z.array(z.object({ id: z.string().min(1) })),
})

export type RealSampleLoader = () => Promise<Observation[]>

export function realSamplesBaseUrl(): string {
  return `${import.meta.env.BASE_URL}samples/`
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json() as Promise<unknown>
}

/** A loader that fetches once and caches the result; a failed load is retried on the next call. */
export function createRealSampleLoader(
  fetchImpl: typeof fetch | undefined = globalThis.fetch,
  baseUrl: string = realSamplesBaseUrl(),
): RealSampleLoader {
  let pending: Promise<Observation[]> | null = null

  async function load(): Promise<Observation[]> {
    if (!fetchImpl) return []
    const index = IndexSchema.safeParse(await fetchJson(fetchImpl, `${baseUrl}index.json`))
    if (!index.success) return []
    const observations = await Promise.all(
      index.data.samples.map(async ({ id }) => {
        try {
          const raw = await fetchJson(
            fetchImpl,
            `${baseUrl}${encodeURIComponent(id)}/observation.json`,
          )
          const parsed = parseObservation(raw)
          return parsed.status === 'invalid' ? null : parsed.data
        } catch {
          return null
        }
      }),
    )
    return observations.filter((o): o is Observation => o !== null)
  }

  return () => {
    pending ??= load().catch(() => {
      pending = null
      return []
    })
    return pending
  }
}

/** Shared by every mock API instance, so the files are fetched once per page load. */
export const loadRealSamples: RealSampleLoader = createRealSampleLoader()
