import { divIcon, DomEvent, type LeafletMouseEvent } from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker } from 'react-leaflet'
import { DENSITY_LEVELS } from '@/lib/density'
import { latLngToTuple } from '@/lib/geo'
import type { Hotspot } from '@/lib/hotspots'

/** Lucide "flag" glyph, inline so the marker needs no extra request. */
const FLAG_SVG =
  '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/></svg>'

function hotspotLabel(hotspot: Pick<Hotspot, 'rank' | 'level'>): string {
  return `Hotspot ${hotspot.rank}, ${DENSITY_LEVELS[hotspot.level].label}`
}

function hotspotIcon(hotspot: Hotspot, selected: boolean) {
  const color = DENSITY_LEVELS[hotspot.level].stroke
  const flag =
    hotspot.level === 'critical' ? `<span class="mwi-hotspot__flag">${FLAG_SVG}</span>` : ''
  // The marker is a button named by its content, so the full label goes in as screen reader text.
  return divIcon({
    className: 'mwi-hotspot',
    html: `<span class="sr-only">${hotspotLabel(hotspot)}</span><span aria-hidden="true" class="mwi-hotspot__badge${selected ? ' is-selected' : ''}" style="--level-color:${color}">${hotspot.rank}${flag}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const HotspotMarker = memo(function HotspotMarker({
  hotspot,
  selected,
  interactive,
  onSelect,
}: {
  hotspot: Hotspot
  selected: boolean
  interactive: boolean
  onSelect: (id: string) => void
}) {
  const icon = useMemo(() => hotspotIcon(hotspot, selected), [hotspot, selected])
  const eventHandlers = useMemo(
    () =>
      interactive
        ? {
            click: (event: LeafletMouseEvent) => {
              DomEvent.stopPropagation(event)
              onSelect(hotspot.id)
            },
          }
        : {},
    [interactive, hotspot.id, onSelect],
  )
  return (
    <Marker
      position={latLngToTuple(hotspot.centroid)}
      icon={icon}
      title={hotspotLabel(hotspot)}
      keyboard={interactive}
      interactive={interactive}
      zIndexOffset={selected ? 1000 : 100 - hotspot.rank}
      eventHandlers={eventHandlers}
    />
  )
})

/** Ranked hotspot markers. Critical hotspots carry a small flag. No glow, no pulsing. */
export const HotspotsLayer = memo(function HotspotsLayer({
  hotspots,
  selectedId,
  interactive,
  onSelect,
}: {
  hotspots: readonly Hotspot[]
  selectedId: string | null
  interactive: boolean
  onSelect: (id: string) => void
}) {
  return (
    <>
      {hotspots.map((hotspot) => (
        <HotspotMarker
          key={hotspot.id}
          hotspot={hotspot}
          selected={hotspot.id === selectedId}
          interactive={interactive}
          onSelect={onSelect}
        />
      ))}
    </>
  )
})
