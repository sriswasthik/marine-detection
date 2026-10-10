import { useMemo, useState } from 'react'
import { useCurrentObservationId } from '@/features/observations/currentObservationContext'
import { useObservation, useObservations } from '@/features/observations/hooks'
import type { LatLng } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { compassDirection, forecastDrift } from '@/lib/drift'

function formatCoord({ lat, lng }: LatLng) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`
}

/**
 * A yellow box fixed to the bottom right of the map page, for the observation on the map: where
 * the plastic is now (observed hotspot), where wind and currents carry it (predicted trajectory),
 * the area to search, and the predicted location (src/lib/drift.ts). Can be collapsed to its
 * header.
 */
export function DriftForecast() {
  const [open, setOpen] = useState(true)
  const list = useObservations()
  const id = useCurrentObservationId(list.data?.data)
  const observation = useObservation(id).data?.data
  const forecast = useMemo(
    () =>
      observation ? forecastDrift(observation, analyzeObservation(observation).hotspots) : null,
    [observation],
  )

  if (!observation) return null
  return (
    <aside
      aria-label="Plastic drift forecast"
      className="fixed right-4 bottom-[calc(var(--tabbar-offset)+16px)] z-[60] w-[300px] max-w-[calc(100vw-32px)] border border-[#B8993A] bg-[#FFE45C] text-[#0B1520] shadow-popover print:hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-small font-semibold"
      >
        <span>Predicted plastic location</span>
        <span aria-hidden="true">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[#B8993A] px-3 py-2 text-small">
          {forecast ? (
            <>
              <p>
                Plastic moves with the weather (wind and currents): drifting {forecast.speedKmH}{' '}
                km/h toward {compassDirection(forecast.bearingDeg)}.
              </p>
              <section>
                <h3 className="font-semibold">Observed hotspot</h3>
                <p className="font-mono text-mono">{formatCoord(forecast.observed)}</p>
              </section>
              <section>
                <h3 className="font-semibold">Predicted trajectory</h3>
                <ul className="font-mono text-mono">
                  {forecast.trajectory.map(({ hours, point }) => (
                    <li key={hours}>
                      +{hours} h: {formatCoord(point)}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="font-semibold">Search zone</h3>
                <p className="font-mono text-mono">
                  {formatCoord(forecast.searchZone.centre)}, radius {forecast.searchZone.radiusKm}{' '}
                  km
                </p>
              </section>
              <section>
                <h3 className="font-semibold">Predicted location</h3>
                <p className="font-mono text-mono">{formatCoord(forecast.predicted)}</p>
              </section>
            </>
          ) : (
            <p>No debris detected in this image, so there is no plastic to track.</p>
          )}
        </div>
      )}
    </aside>
  )
}
