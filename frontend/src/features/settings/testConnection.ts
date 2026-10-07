import { createHttpApi } from '@/features/observations/api/httpApi'
import { withResilience } from '@/features/observations/api/resilientApi'
import type { HealthStatus } from '@/features/observations/api/types'
import { createAppError, toAppError, type AppError } from '@/lib/errors/appError'

export type ConnectionResult = { ok: true; health: HealthStatus } | { ok: false; error: AppError }

/** Time limit for the test: long enough for a cold start, short enough to feel responsive. */
export const CONNECTION_TEST_TIMEOUT_MS = 8000

/**
 * Calls GET {baseUrl}/health. Never throws: success carries the model the service runs, failure a
 * specific AppError (offline, unreachable, timed out, wrong address, unexpected answer).
 */
export async function testConnection(
  baseUrl: string,
  fetchImpl?: typeof fetch,
): Promise<ConnectionResult> {
  try {
    const api = withResilience(createHttpApi(baseUrl, fetchImpl), {
      timeoutMs: CONNECTION_TEST_TIMEOUT_MS,
    })
    const health = await api.health()
    if (!health.ok) return { ok: false, error: createAppError('SERVICE_UNAVAILABLE') }
    return { ok: true, health }
  } catch (error) {
    return { ok: false, error: toAppError(error) }
  }
}
