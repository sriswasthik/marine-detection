/** WCAG 2.x contrast helpers. */

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Parses #RGB or #RRGGBB. */
export function parseHex(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '')
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new TypeError(`Not a hex colour: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(channel) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Ratio from 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** WCAG AA minimum for normal-size text. */
export const AA_TEXT = 4.5
