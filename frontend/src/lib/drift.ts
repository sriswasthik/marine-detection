import { createRandom } from '@/features/observations/mock/random'
import type { Detection, GeoBounds, Hotspot, LatLng } from '@/features/observations/types'
import { haversineDistanceM, metersToDegrees } from '@/lib/geo'

/** Hours ahead of the image capture that the trajectory is predicted for. */
export const DRIFT_FORECAST_HOURS = [6, 12, 24] as const

/** Surface drift speed range, km/h (wind leeway plus current), the drift is drawn from. */
export const DRIFT_SPEED_RANGE_KMH = [0.3, 1.5] as const

export interface DriftPoint {
  hours: number
  point: LatLng
}

export interface DriftForecast {
  /** Where the plastic is seen in the image: the top hotspot, else the debris centre. */
  observed: LatLng
  /** Direction the plastic drifts toward, degrees clockwise from north. */
  bearingDeg: number
  speedKmH: number
  trajectory: DriftPoint[]
  /** Circle covering the observed hotspot, the trajectory and a margin for uncertainty. */
  searchZone: { centre: LatLng; radiusKm: number }
  /** The last trajectory point. */
  predicted: LatLng
}

export interface DriftInput {
  id: string
  bounds: GeoBounds | null
  detections: readonly Detection[]
  geospatial?: { debrisCentroid: LatLng | null }
}

/** Area-weighted mean of the detection centroids. Null without detections. */
function detectionsCentre(detections: readonly Detection[]): LatLng | null {
  const total = detections.reduce((sum, d) => sum + d.areaM2, 0)
  if (detections.length === 0 || total <= 0) return null
  return {
    lat: detections.reduce((sum, d) => sum + d.centroid.lat * d.areaM2, 0) / total,
    lng: detections.reduce((sum, d) => sum + d.centroid.lng * d.areaM2, 0) / total,
  }
}

/** The point `distanceM` away from `from` toward `bearingDeg` (fine for tens of kilometers). */
export function movePoint(from: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const radians = (bearingDeg * Math.PI) / 180
  const { dLat, dLng } = metersToDegrees(
    { dxM: distanceM * Math.sin(radians), dyM: distanceM * Math.cos(radians) },
    from.lat,
  )
  return { lat: from.lat + dLat, lng: from.lng + dLng }
}

/** Eight-point compass name for a bearing, for example 47 is "NE". */
export function compassDirection(bearingDeg: number): string {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
  const index = Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8
  return names[index] ?? 'N'
}

/**
 * Where the plastic in one analysed image drifts with the weather. The start point comes from
 * the image (its top-ranked hotspot, else the debris centre); the drift speed and direction are
 * drawn from the observation id, so each image gets its own forecast and the same image always
 * gets the same one. Null when the image holds no debris.
 */
export function forecastDrift(
  observation: DriftInput,
  hotspots: readonly Hotspot[],
): DriftForecast | null {
  const observed =
    hotspots[0]?.centroid ??
    observation.geospatial?.debrisCentroid ??
    detectionsCentre(observation.detections)
  if (!observed) return null

  const random = createRandom(`drift:${observation.id}`)
  const bearingDeg = Math.round(random.range(0, 360))
  const speedKmH = Math.round(random.range(...DRIFT_SPEED_RANGE_KMH) * 10) / 10

  const trajectory = DRIFT_FORECAST_HOURS.map((hours) => ({
    hours,
    point: movePoint(observed, bearingDeg, speedKmH * hours * 1000),
  }))
  const predicted = trajectory[trajectory.length - 1]?.point ?? observed

  const travelledM = haversineDistanceM(observed, predicted)
  const centre = {
    lat: (observed.lat + predicted.lat) / 2,
    lng: (observed.lng + predicted.lng) / 2,
  }
  // Half the path, plus a quarter of it (at least 1 km) for the uncertainty in the drift.
  const radiusM = travelledM / 2 + Math.max(1000, travelledM / 4)
  const radiusKm = Math.ceil(radiusM / 100) / 10

  return { observed, bearingDeg, speedKmH, trajectory, searchZone: { centre, radiusKm }, predicted }
}
