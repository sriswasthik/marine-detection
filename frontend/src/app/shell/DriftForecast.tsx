import { useState } from 'react'

/** Sample coordinates for the drift forecast box. Illustrative only, not model output. */
const OBSERVED_HOTSPOT = { lat: 15.8312, lng: -86.2471 }
const PREDICTED_TRAJECTORY = [
  { label: '+6 h', lat: 15.8475, lng: -86.2198 },
  { label: '+12 h', lat: 15.8641, lng: -86.1923 },
  { label: '+24 h', lat: 15.8968, lng: -86.1385 },
]
const SEARCH_ZONE = { centre: { lat: 15.864, lng: -86.1928 }, radiusKm: 6.5 }
const PREDICTED_LOCATION = { lat: 15.8968, lng: -86.1385 }

function formatCoord({ lat, lng }: { lat: number; lng: number }) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`
}

/**
 * A yellow box fixed to the bottom right of the map page: where the plastic is now (observed
 * hotspot), where wind and currents carry it (predicted trajectory), the area to search, and the
 * predicted location. Can be collapsed to its header.
 */
export function DriftForecast() {
  const [open, setOpen] = useState(true)

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
          <p>Plastic moves with the weather (wind and currents).</p>
          <section>
            <h3 className="font-semibold">Observed hotspot</h3>
            <p className="font-mono text-mono">{formatCoord(OBSERVED_HOTSPOT)}</p>
          </section>
          <section>
            <h3 className="font-semibold">Predicted trajectory</h3>
            <ul className="font-mono text-mono">
              {PREDICTED_TRAJECTORY.map((point) => (
                <li key={point.label}>
                  {point.label}: {formatCoord(point)}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="font-semibold">Search zone</h3>
            <p className="font-mono text-mono">
              {formatCoord(SEARCH_ZONE.centre)}, radius {SEARCH_ZONE.radiusKm} km
            </p>
          </section>
          <section>
            <h3 className="font-semibold">Predicted location</h3>
            <p className="font-mono text-mono">{formatCoord(PREDICTED_LOCATION)}</p>
          </section>
        </div>
      )}
    </aside>
  )
}
