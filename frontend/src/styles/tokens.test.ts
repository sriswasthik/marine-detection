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
  ['ink', 'paper', 'body text on paper'],
  ['ink', 'sheet', 'body text on docked panels and map plates'],
  ['ink', 'raised', 'text in inputs, the drawer and dialogs'],
  ['tar', 'paper', 'the wordmark and headlines'],
  ['accent-ink', 'sheet', 'links on docked panels'],
  ['ink-2', 'paper', 'secondary and small text on the page'],
  ['ink-2', 'sheet', 'secondary text on panels and tooltips'],
  ['ink-2', 'raised', 'secondary text in the drawer and dialogs'],
  ['accent-ink', 'paper', 'links and tertiary actions'],
  ['accent-ink', 'raised', 'links in the drawer and dialogs'],
  ['accent-ink', 'accent-wash', 'selected segment and accent tag'],
  ['ink', 'accent-wash', 'selected ledger row'],
  ['on-accent', 'accent', 'primary button label'],
  ['on-accent', 'accent-hover', 'primary button label on hover'],
  ['white', 'ink', 'done step, checked box, secondary button on hover'],
  ['paper', 'tar', 'the first-ranked hotspot plate'],
  ['success', 'paper', 'success text and saved notes'],
  ['warning', 'paper', 'warning text'],
  ['danger', 'paper', 'danger text and quiet danger button'],
  ['danger', 'danger-soft', 'quiet danger button on hover'],
  ['ink', 'success-soft', 'success tag'],
  ['ink', 'warning-soft', 'warning tag and low confidence tag'],
  ['ink', 'danger-soft', 'danger tag'],
  ...DENSITY_LEVEL_IDS.map((level) => ['ink', `${level}-soft`, `${level} severity tag`] as const),
  ['tar', 'low', 'Low cluster count'],
  ['tar', 'moderate', 'Moderate cluster count'],
  ['white', 'high', 'High cluster count'],
  ['white', 'critical', 'Critical cluster count'],
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

  it('keeps ink-3 for large or decorative text only: it fails small text on paper', () => {
    const ratio = contrastRatio(token('ink-3'), token('paper'))
    expect(ratio).toBeLessThan(AA_TEXT)
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('keeps the call to action apart from links: ink fill, Ultramarine links', () => {
    expect(token('accent')).not.toBe(token('accent-ink'))
    expect(contrastRatio(token('accent'), token('paper'))).toBeGreaterThan(15)
  })

  it('uses the Survey sheet palette', () => {
    expect(token('paper')).toBe('#f7f6f2')
    expect(token('raised')).toBe('#ffffff')
    expect(token('ink')).toBe('#1c2530')
    expect(token('accent')).toBe('#0b1520')
    expect(token('accent-ink')).toBe('#2235c9')
  })

  it('has no old token names left', () => {
    for (const old of ['bg', 'surface', 'border', 'border-strong', 'ink-muted', 'accent-soft']) {
      expect(tokens.has(old), `--color-${old}`).toBe(false)
    }
  })
})
