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
  ['ink', 'bg', 'body text on the page'],
  ['ink', 'surface', 'body text on cards and panels'],
  ['ink-muted', 'bg', 'secondary text on the page'],
  ['ink-muted', 'surface', 'secondary text on cards'],
  ['accent', 'surface', 'links and accent text'],
  ['accent', 'bg', 'links on the page'],
  ['white', 'accent', 'primary button label'],
  ['white', 'accent-hover', 'primary button label on hover'],
  ['accent', 'accent-soft', 'accent badge'],
  ['success', 'surface', 'success text'],
  ['success', 'success-soft', 'success badge'],
  ['warning', 'surface', 'warning text'],
  ['warning', 'warning-soft', 'warning badge and banner icon'],
  ['danger', 'surface', 'danger text and quiet danger button'],
  ['danger', 'danger-soft', 'danger badge'],
  ['ink', 'warning-soft', 'low confidence badge text'],
  ['ink', 'info-soft', 'info banner text'],
  ['ink', 'danger-soft', 'danger banner text'],
  ...DENSITY_LEVEL_IDS.map((level) => ['ink', `${level}-soft`, `${level} severity badge`] as const),
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
})
