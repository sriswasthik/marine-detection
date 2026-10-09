import { formatInteger } from '@/lib/format'

/**
 * The map toolbar's status text: "61 detections · 3 hotspots", or "42 of 61 detections · 2
 * hotspots" while filters hide some. A no-debris result says so.
 */
export function mapStatusText({
  shown,
  total,
  hotspots,
  filtered,
}: {
  shown: number
  total: number
  hotspots: number
  filtered: boolean
}): string {
  if (total === 0) return 'No debris detected'
  const noun = total === 1 ? 'detection' : 'detections'
  const count =
    filtered && shown !== total
      ? `${formatInteger(shown)} of ${formatInteger(total)} ${noun}`
      : `${formatInteger(total)} ${noun}`
  return `${count} · ${formatInteger(hotspots)} ${hotspots === 1 ? 'hotspot' : 'hotspots'}`
}
