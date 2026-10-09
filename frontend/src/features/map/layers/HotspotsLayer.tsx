import { divIcon, DomEvent, type LeafletMouseEvent } from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker, Rectangle } from 'react-leaflet'
import { DENSITY_LEVELS } from '@/lib/density'
import { boundsToLeaflet, latLngToTuple } from '@/lib/geo'
import { MAP_COLORS } from '@/lib/map/basemaps'
import type { Hotspot } from '@/lib/hotspots'

function hotspotLabel(hotspot: Pick<Hotspot, 'rank' | 'level'>): string {
  return `Hotspot ${hotspot.rank}, ${DENSITY_LEVELS[hotspot.level].label}`
}

/** The marker box: a 22px ring centred in it, the rank label in its top-right corner. */
const BOX = 34
const RING_RADIUS = 11

/**
 * A ring, not a disc: a 1.5px stroke in the level's colour over a thin white casing, with a
 * transparent centre so the detections it marks stay visible. Selected, the ring turns Tar Black
 * and thicker (map.css). The rank sits in a small mono label at the top right; rank 1 is inverted
 * so the eye finds it first.
 */
function hotspotMarkerHtml(hotspot: Pick<Hotspot, 'rank' | 'level'>, selected: boolean) {
  const color = DENSITY_LEVELS[hotspot.level].stroke
  const c = BOX / 2
  const svg =
    `<svg viewBox="0 0 ${BOX} ${BOX}" width="${BOX}" height="${BOX}" aria-hidden="true">` +
    `<circle class="mwi-hotspot__casing" cx="${c}" cy="${c}" r="${RING_RADIUS}" />` +
    `<circle class="mwi-hotspot__ring" cx="${c}" cy="${c}" r="${RING_RADIUS}" style="--level-color:${color}" />` +
    `</svg>`
  const rank = `<span class="mwi-hotspot__rank${hotspot.rank === 1 ? ' is-first' : ''}">${hotspot.rank}</span>`
  return `<span class="sr-only">${hotspotLabel(hotspot)}</span><span aria-hidden="true" class="mwi-hotspot__target${selected ? ' is-selected' : ''}">${svg}${rank}</span>`
}

function hotspotIcon(hotspot: Hotspot, selected: boolean) {
  // The marker is a button named by its content, so the full label goes in as screen reader text.
  return divIcon({
    className: 'mwi-hotspot hit-area',
    html: hotspotMarkerHtml(hotspot, selected),
    iconSize: [BOX, BOX],
    iconAnchor: [BOX / 2, BOX / 2],
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

const HOTSPOT_OUTLINE = {
  color: MAP_COLORS.mark,
  weight: 1.5,
  opacity: 1,
  dashArray: '5 4',
  fill: false,
}

/**
 * Ranked hotspot rings. No glow, no pulsing.
 * The selected or highlighted hotspot also gets a dashed outline of the cells it covers.
 */
export const HotspotsLayer = memo(function HotspotsLayer({
  hotspots,
  selectedId,
  highlightedId,
  interactive,
  onSelect,
}: {
  hotspots: readonly Hotspot[]
  selectedId: string | null
  /** Emphasised from outside the map, for example while hovering a row in a list. */
  highlightedId?: string | null
  interactive: boolean
  onSelect: (id: string) => void
}) {
  const outlined = hotspots.find((h) => h.id === (highlightedId ?? selectedId))
  return (
    <>
      {outlined ? (
        <Rectangle
          key={outlined.id}
          bounds={boundsToLeaflet(outlined.bounds)}
          pathOptions={HOTSPOT_OUTLINE}
          interactive={false}
        />
      ) : null}
      {hotspots.map((hotspot) => (
        <HotspotMarker
          key={hotspot.id}
          hotspot={hotspot}
          selected={hotspot.id === selectedId || hotspot.id === highlightedId}
          interactive={interactive}
          onSelect={onSelect}
        />
      ))}
    </>
  )
})
