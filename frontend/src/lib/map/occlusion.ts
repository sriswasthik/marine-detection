/**
 * How much of the map the detail drawer hides, so focusing on a detection or hotspot lands in the
 * part that is still visible: left of the drawer on desktop, above the bottom sheet on mobile.
 */

/** Mirrors --spacing-drawer in src/styles/tokens.css. */
export const DRAWER_WIDTH_PX = 400

/** The mobile bottom sheet opens at this share of the viewport height; it can expand to 85%. */
export const SHEET_PEEK_FRACTION = 0.5

export interface OccludedEdges {
  right: number
  bottom: number
}

export const NOTHING_OCCLUDED: OccludedEdges = { right: 0, bottom: 0 }

export function occludedEdges(options: {
  drawerOpen: boolean
  isDesktop: boolean
  viewportHeight: number
}): OccludedEdges {
  if (!options.drawerOpen) return NOTHING_OCCLUDED
  return options.isDesktop
    ? { right: DRAWER_WIDTH_PX, bottom: 0 }
    : { right: 0, bottom: Math.round(options.viewportHeight * SHEET_PEEK_FRACTION) }
}

/** Leaflet fit and pan padding that keeps `padding` px of margin inside the visible area. */
export function visiblePadding(
  padding: number,
  occluded: OccludedEdges,
): { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] } {
  return {
    paddingTopLeft: [padding, padding],
    paddingBottomRight: [padding + occluded.right, padding + occluded.bottom],
  }
}
