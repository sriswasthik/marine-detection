/**
 * The one-time fade-in of detections when a fresh result opens on the map: each detection fades
 * in over FADE_MS, starting a little after the previous one, all within REVEAL_TOTAL_MS. Opacity
 * only, no movement; skipped entirely when the user prefers reduced motion.
 */
export const REVEAL_FADE_MS = 250
export const REVEAL_STAGGER_MS = 300
export const REVEAL_TOTAL_MS = REVEAL_STAGGER_MS + REVEAL_FADE_MS
/** Opacity steps: shapes re-render only when their step changes, not every frame. */
export const REVEAL_STEPS = 10

/** 0 to 1 for the detection at `index` of `count`, `elapsedMs` after the reveal started. */
export function revealFactor(index: number, count: number, elapsedMs: number): number {
  const start = count > 1 ? (index / (count - 1)) * REVEAL_STAGGER_MS : 0
  const linear = Math.min(Math.max((elapsedMs - start) / REVEAL_FADE_MS, 0), 1)
  return Math.round(linear * REVEAL_STEPS) / REVEAL_STEPS
}

/** Scales a path style's opacities by the reveal factor. */
export function revealStyle<T extends { opacity?: number; fillOpacity?: number }>(
  style: T,
  factor: number,
): T {
  if (factor >= 1) return style
  return {
    ...style,
    opacity: (style.opacity ?? 1) * factor,
    fillOpacity: (style.fillOpacity ?? 0.2) * factor,
  }
}
