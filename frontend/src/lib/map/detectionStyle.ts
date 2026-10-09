import type { DensityLevel, Detection } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import { DENSITY_LEVELS } from '@/lib/density'
import { MAP_COLORS } from './basemaps'

/** The subset of Leaflet PathOptions the map uses. Leaflet-free so it can be unit tested. */
export interface PathStyle {
  color: string
  weight: number
  opacity: number
  fillColor: string
  fillOpacity: number
  dashArray: string | undefined
  fill: boolean
}

export interface DetectionStyleState {
  selected: boolean
  hovered: boolean
  /** Drawn over satellite imagery: dark water needs a light outline and stronger fill. */
  onImagery?: boolean
}

/** Severity fill at about 0.55 with a 1px stroke in the level's darker colour. */
export const DETECTION_FILL_OPACITY = 0.55
export const LOW_CONFIDENCE_FILL_OPACITY = 0.3
/** Over imagery: stronger fill and a 1.5px white casing, so severity stays readable on dark water. */
export const IMAGERY_FILL_OPACITY = 0.8
export const IMAGERY_LOW_CONFIDENCE_FILL_OPACITY = 0.5
export const LOW_CONFIDENCE_STROKE_OPACITY = 0.8
export const EMPHASIS_FILL_BOOST = 0.15
export const LOW_CONFIDENCE_DASH = '4 3'
export const DETECTION_STROKE_WEIGHT = 1
export const IMAGERY_STROKE_WEIGHT = 1.5
export const HOVER_STROKE_WEIGHT = 3
export const SELECTED_STROKE_WEIGHT = 2.5
export const SELECTION_HALO_WEIGHT = 7

export function isLowConfidence(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLDS.low
}

/**
 * Detection style. Fill and stroke come from the density level. Confidence below the low
 * threshold gets a dashed stroke and lower opacity, in every state, so confidence stays readable.
 * Hover thickens the stroke. Selection swaps the stroke to the tar mark; a white casing is
 * drawn underneath with getSelectionHaloStyle. Over imagery the outline is white and the fill
 * stronger, so levels stay readable on dark water.
 */
export function getDetectionStyle(
  detection: Pick<Detection, 'densityLevel' | 'confidence'>,
  state: DetectionStyleState,
): PathStyle {
  const level = DENSITY_LEVELS[detection.densityLevel]
  const lowConfidence = isLowConfidence(detection.confidence)
  const onImagery = state.onImagery ?? false
  const baseFill = onImagery
    ? lowConfidence
      ? IMAGERY_LOW_CONFIDENCE_FILL_OPACITY
      : IMAGERY_FILL_OPACITY
    : lowConfidence
      ? LOW_CONFIDENCE_FILL_OPACITY
      : DETECTION_FILL_OPACITY
  const emphasised = state.selected || state.hovered
  return {
    color: state.selected ? MAP_COLORS.mark : onImagery ? MAP_COLORS.halo : level.stroke,
    weight: state.selected
      ? SELECTED_STROKE_WEIGHT
      : state.hovered
        ? HOVER_STROKE_WEIGHT
        : onImagery
          ? IMAGERY_STROKE_WEIGHT
          : DETECTION_STROKE_WEIGHT,
    opacity: lowConfidence && !state.selected ? LOW_CONFIDENCE_STROKE_OPACITY : 1,
    fillColor: level.color,
    fillOpacity: emphasised ? baseFill + EMPHASIS_FILL_BOOST : baseFill,
    dashArray: lowConfidence ? LOW_CONFIDENCE_DASH : undefined,
    fill: true,
  }
}

/** White casing under a selected detection so the ink outline reads on any basemap or imagery. */
export function getSelectionHaloStyle(): PathStyle {
  return {
    color: MAP_COLORS.casing,
    weight: SELECTION_HALO_WEIGHT,
    opacity: 1,
    fillColor: MAP_COLORS.casing,
    fillOpacity: 0,
    dashArray: undefined,
    fill: false,
  }
}

/** Radius of the centroid marker used when a detection is too small to draw as a polygon. */
export function detectionPointRadius(state: DetectionStyleState): number {
  return state.selected || state.hovered ? 5 : 4
}

/** Density grid cell: flat and lighter than detections, with a faint edge in the level colour. */
export function getDensityCellStyle(
  level: DensityLevel,
  hovered = false,
  onImagery = false,
): PathStyle {
  const meta = DENSITY_LEVELS[level]
  const fill = onImagery ? 0.38 : 0.22
  return {
    color: onImagery ? meta.color : meta.stroke,
    weight: hovered ? 1.5 : 0.75,
    opacity: hovered ? 0.9 : onImagery ? 0.6 : 0.35,
    fillColor: meta.color,
    fillOpacity: hovered ? fill + 0.1 : fill,
    dashArray: undefined,
    fill: true,
  }
}

/**
 * Source image footprint: a quiet 1px dashed line in the muted ink colour (white over imagery),
 * dotted when georeferencing is partial. It frames the scene without competing with the data.
 */
export function getFootprintStyle(approximate: boolean, onImagery = false): PathStyle {
  return {
    color: onImagery ? MAP_COLORS.halo : MAP_COLORS.muted,
    weight: 1,
    opacity: 0.9,
    fillColor: MAP_COLORS.muted,
    fillOpacity: 0,
    dashArray: approximate ? '1 4' : '6 4',
    fill: false,
  }
}

export function footprintLabel(approximate: boolean): string {
  return approximate ? 'Approximate footprint' : 'Source image footprint'
}
