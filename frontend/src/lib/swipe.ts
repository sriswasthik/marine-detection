/**
 * Value math for the compare divider: a position from 0 (far left) to 100 (far right), in percent
 * of the viewer width. DOM-free so pointer and keyboard behaviour can be unit tested.
 */

export const SWIPE_MIN = 0
export const SWIPE_MAX = 100
export const SWIPE_DEFAULT = 50
/** Arrow keys move one step; Page Up / Page Down and Shift + arrow move a large step. */
export const SWIPE_STEP = 2
export const SWIPE_LARGE_STEP = 10

export function clampSwipe(value: number): number {
  if (!Number.isFinite(value)) return SWIPE_DEFAULT
  return Math.min(SWIPE_MAX, Math.max(SWIPE_MIN, value))
}

/** Divider position under a pointer at `clientX`, for a viewer starting at `left` that is `width` wide. */
export function swipeFromPointer(clientX: number, rect: { left: number; width: number }): number {
  if (!(rect.width > 0)) return SWIPE_DEFAULT
  return clampSwipe(((clientX - rect.left) / rect.width) * 100)
}

/**
 * Divider position after a key press, or null when the key does nothing (so the event is left alone).
 * Right and Up move right, Left and Down move left, Home and End jump to the edges.
 */
export function swipeFromKey(key: string, current: number, options: { large?: boolean } = {}) {
  const step = options.large ? SWIPE_LARGE_STEP : SWIPE_STEP
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clampSwipe(current + step)
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampSwipe(current - step)
    case 'PageUp':
      return clampSwipe(current + SWIPE_LARGE_STEP)
    case 'PageDown':
      return clampSwipe(current - SWIPE_LARGE_STEP)
    case 'Home':
      return SWIPE_MIN
    case 'End':
      return SWIPE_MAX
    default:
      return null
  }
}

/** CSS clip-path that keeps the left `position` percent of the top layer visible. */
export function swipeClipPath(position: number): string {
  return `inset(0 ${SWIPE_MAX - clampSwipe(position)}% 0 0)`
}
