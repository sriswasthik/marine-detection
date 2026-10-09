import { describe, expect, it } from 'vitest'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { AA_TEXT, contrastRatio } from '@/lib/contrast'
import tokensCss from './tokens.css?raw'

/** Every `--color-name: #hex;` in tokens.css. */
function readColorTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>()
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)) {
    const [, name, value] = match
    if (name && value) tokens.set(name, value)
  }
  return tokens
}

const tokens = readColorTokens(tokensCss)

function token(name: string): string {
  const value = tokens.get(name)
  if (!value) throw new Error(`Token --color-${name} is missing from tokens.css`)
  return value
}

/** [text, background, where it is used]. Every pair must reach AA for normal text. */
const TEXT_PAIRS: readonly (readonly [string, string, string])[] = [
  ['ink', 'paper', 'Graphite body text on Concrete'],
  ['ink', 'sheet', 'body text on docked panels and map plates'],
  ['ink', 'white', 'text in inputs, the drawer and dialogs'],
  ['tar', 'paper', 'the wordmark'],
  ['ink-2', 'paper', 'Slate Grey secondary and small text on the page'],
  ['ink-2', 'sheet', 'secondary text on panels and tooltips'],
  ['ink-2', 'white', 'secondary text in the drawer and dialogs'],
  ['accent-ink', 'paper', 'Olive Ink links and tertiary actions'],
  ['accent-ink', 'white', 'links in the drawer and dialogs'],
  ['accent-ink', 'accent-wash', 'selected segment and accent tag'],
  ['ink', 'accent-wash', 'selected ledger row'],
  ['white', 'accent', 'primary button label'],
  ['white', 'accent-hover', 'primary button label on hover'],
  ['white', 'ink', 'done step and checked box'],
  ['success', 'paper', 'success text and saved notes'],
  ['warning', 'paper', 'warning text'],
  ['danger', 'paper', 'danger text and quiet danger button'],
  ['danger', 'danger-soft', 'quiet danger button on hover'],
  ['ink', 'success-soft', 'success tag'],
  ['ink', 'warning-soft', 'warning tag and low confidence tag'],
  ['ink', 'danger-soft', 'danger tag'],
  ...DENSITY_LEVEL_IDS.map((level) => ['ink', `${level}-soft`, `${level} severity tag`] as const),
]

describe('design token contrast', () => {
  it('parses the colour tokens', () => {
    expect(tokens.size).toBeGreaterThan(20)
  })

  it.each(TEXT_PAIRS)('%s on %s reaches 4.5:1 (%s)', (text, background) => {
    const ratio = contrastRatio(token(text), token(background))
    expect(ratio, `${text} on ${background} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      AA_TEXT,
    )
  })

  it('keeps ink-3 for large or decorative text only: it fails small text on Concrete', () => {
    const ratio = contrastRatio(token('ink-3'), token('paper'))
    expect(ratio).toBeLessThan(AA_TEXT)
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('keeps Signal Yellow out of the interface: it is the logomark colour only', () => {
    // 1.3:1 on Concrete, and next to the Low severity fill: never an action, text or line.
    expect(contrastRatio(token('signal'), token('paper'))).toBeLessThan(3)
    expect(token('accent')).not.toBe(token('signal'))
    expect(token('accent-wash')).not.toBe(token('low-soft'))
  })

  it('uses the deck palette', () => {
    expect(token('paper')).toBe('#e7e4dc')
    expect(token('tar')).toBe('#15171a')
    expect(token('ink')).toBe('#3a3b3d')
    expect(token('ink-2')).toBe('#5a5a55')
    expect(token('accent')).toBe('#15171a')
    expect(token('signal')).toBe('#f4c51d')
    expect(token('accent-ink')).toBe('#3b3420')
  })

  it('matches the measured values in docs/DESIGN_SYSTEM.md', () => {
    const on = (text: string, background: string) =>
      Math.round(contrastRatio(token(text), token(background)) * 100) / 100
    expect(on('ink', 'paper')).toBeCloseTo(8.83, 1)
    expect(on('ink-2', 'paper')).toBeCloseTo(5.46, 1)
    expect(on('accent-ink', 'paper')).toBeCloseTo(9.73, 1)
    expect(on('white', 'accent')).toBeCloseTo(17.96, 1)
  })

  it('has no old token names left', () => {
    for (const old of ['bg', 'surface', 'border', 'border-strong', 'ink-muted', 'accent-soft']) {
      expect(tokens.has(old), `--color-${old}`).toBe(false)
    }
  })
})
