#!/usr/bin/env node
/**
 * Design audit: measures what the UI actually renders, per route and viewport, against the
 * targets in docs/DESIGN_SYSTEM.md. Starts its own Vite dev server in sample-data mode, so the
 * result does not depend on .env or a server that is already running.
 *
 *   npm run design:audit                         table + ../docs/design/audit.json
 *   npm run design:audit -- --shots ../docs/design/before    also saves screenshots
 *   npm run design:audit -- --only overview,map-hotspot      a subset of routes
 *   npm run design:audit -- --base http://localhost:5173     use a running server instead
 *
 * Routes and multi-step states come from scripts/design-audit.routes.json.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(HERE, '..')

export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]

/** Pass/fail targets, mirrored in docs/DESIGN_SYSTEM.md ("Audit thresholds"). */
export const TARGETS = {
  fontSizes: 8,
  fontWeights: 3,
  fontFamilies: 2,
  offGridSpacing: 0,
  pills: 0,
  cards: 0,
  gradients: 0,
  shadows: 2,
  primaryButtons: 1,
  contrastFailures: 0,
  smallTargets: 0,
  leftEdges: 3,
}

function parseArgs(argv) {
  const args = {
    routes: resolve(HERE, 'design-audit.routes.json'),
    out: resolve(FRONTEND, '../docs/design/audit.json'),
  }
  for (let i = 0; i < argv.length; i++) {
    const [key, value] = [argv[i], argv[i + 1]]
    if (key === '--shots') args.shots = resolve(process.cwd(), value)
    else if (key === '--only') args.only = value.split(',')
    else if (key === '--base') args.base = value
    else if (key === '--routes') args.routes = resolve(process.cwd(), value)
    else if (key === '--out') args.out = resolve(process.cwd(), value)
    else continue
    i++
  }
  return args
}

/**
 * Runs inside the page. Returns raw measurements for one route and viewport.
 * Definitions are written out so the numbers can be checked by hand.
 */
function measure({ mobile }) {
  // The primary fill: Tar Black, plus the earlier yellow and teal fills for the baselines.
  const ACCENT = new Set([
    'rgb(21, 23, 26)',
    'rgb(244, 197, 29)',
    'rgb(224, 180, 20)',
    'rgb(47, 111, 109)',
    'rgb(36, 88, 86)',
    'rgb(38, 89, 87)',
  ])
  const px = (value) => parseFloat(value) || 0

  const visible = (el) => {
    const style = getComputedStyle(el)
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0
    )
      return false
    // Screen-reader-only content (clipped, or 1px boxes) is not rendered for sighted users.
    if (style.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(style.clipPath))
      return false
    const rect = el.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1
  }
  /** Leaflet's own DOM (panes, tiles, markers' offsets, attribution): measured as the library's. */
  const insideLeaflet = (el) => Boolean(el.closest('.leaflet-pane, .leaflet-control-container'))
  const describe = (el) => {
    const text = (el.getAttribute('aria-label') || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40)
    return `${el.tagName.toLowerCase()}${text ? ` "${text}"` : ''}`
  }

  // Colours: parse rgb()/rgba(), composite over the effective background.
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const [r, g, b, a = 1] = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number)
    return { r, g, b, a }
  }
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })
  const luminance = ({ r, g, b }) => {
    const c = [r, g, b].map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const ratio = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (l1 + 0.05) / (l2 + 0.05)
  }
  /** Background behind an element, or null when it sits on imagery (map, image, gradient). */
  const backgroundOf = (el) => {
    const layers = []
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (
        style.backgroundImage !== 'none' ||
        node.classList.contains('leaflet-container') ||
        node.tagName === 'IMG'
      )
        return null
      const color = parse(style.backgroundColor)
      if (color && color.a > 0) {
        layers.push(color)
        if (color.a >= 1) break
      }
    }
    return layers
      .reverse()
      .reduce((acc, layer) => over(layer, acc), { r: 255, g: 255, b: 255, a: 1 })
  }
  const effectiveBg = (el) => {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const color = parse(getComputedStyle(node).backgroundColor)
      if (color && color.a > 0) return getComputedStyle(node).backgroundColor
    }
    return 'rgb(255, 255, 255)'
  }

  const all = [...document.querySelectorAll('body *')].filter(visible)

  // 1. Type: every visible text node.
  const sizes = new Map()
  const weights = new Map()
  const families = new Map()
  const contrast = []
  const textElements = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue
    const el = node.parentElement
    if (
      !el ||
      textElements.has(el) ||
      !visible(el) ||
      el.closest('script, style, [aria-hidden="true"] svg')
    )
      continue
    textElements.add(el)
    const style = getComputedStyle(el)
    const size = `${Math.round(px(style.fontSize) * 10) / 10}px`
    sizes.set(size, (sizes.get(size) ?? 0) + 1)
    weights.set(style.fontWeight, (weights.get(style.fontWeight) ?? 0) + 1)
    const family = style.fontFamily.split(',')[0].replace(/["']/g, '').trim()
    families.set(family, (families.get(family) ?? 0) + 1)

    const bg = backgroundOf(el)
    const fg = parse(style.color)
    if (bg && fg) {
      let opacity = 1
      for (let n = el; n && n.nodeType === 1; n = n.parentElement)
        opacity *= parseFloat(getComputedStyle(n).opacity)
      const shown = over({ ...fg, a: fg.a * opacity }, bg)
      const large =
        px(style.fontSize) >= 24 || (px(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700)
      const value = ratio(shown, bg)
      if (value < (large ? 3 : 4.5) && !el.closest(':disabled, [aria-disabled="true"]')) {
        contrast.push({
          element: describe(el),
          ratio: Math.round(value * 100) / 100,
          color: style.color,
        })
      }
    }
  }

  // 2. Spacing that is not a multiple of 4px.
  const offGrid = new Map()
  const SPACING = [
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'rowGap',
    'columnGap',
  ]
  for (const el of all) {
    if (insideLeaflet(el)) continue
    const style = getComputedStyle(el)
    // margin: auto resolves to equal px values on both sides; that is centring, not spacing.
    const centred =
      px(style.marginLeft) > 0 && Math.abs(px(style.marginLeft) - px(style.marginRight)) < 1
    for (const prop of SPACING) {
      if (centred && (prop === 'marginLeft' || prop === 'marginRight')) continue
      const value = style[prop]
      // Fractional margins come from auto (ml-auto, centring), not from a spacing choice.
      if (prop.startsWith('margin') && Math.abs(px(value) - Math.round(px(value))) > 0.01) continue
      if (!value || value === 'normal' || value === 'auto') continue
      const n = px(value)
      if (
        n !== 0 &&
        Math.abs(n % 4) > 0.01 &&
        Math.abs((n % 4) - 4) > 0.01 &&
        Math.abs((n % 4) + 4) > 0.01
      ) {
        const key = `${Math.round(n * 100) / 100}px`
        offGrid.set(key, (offGrid.get(key) ?? 0) + 1)
      }
    }
  }

  // 3. Pills, 4. cards, 5. gradients, 6. shadows.
  const pills = []
  const cards = []
  const shadows = new Map()
  const rings = new Map()
  let gradientElements = 0
  for (const el of all) {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const radius = Math.max(
      px(style.borderTopLeftRadius),
      px(style.borderTopRightRadius),
      px(style.borderBottomLeftRadius),
      px(style.borderBottomRightRadius),
    )
    const isSwitch = el.closest('[role="switch"]')
    if (
      !isSwitch &&
      !insideLeaflet(el) &&
      radius > 0 &&
      (radius >= 999 || radius >= Math.min(rect.width, rect.height) / 2 - 0.5)
    )
      pills.push(describe(el))
    const bordered = ['Top', 'Right', 'Bottom', 'Left'].some(
      (side) => px(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none',
    )
    const shadowed = style.boxShadow !== 'none'
    const bg = parse(style.backgroundColor)
    const control =
      el.matches('input, select, textarea') ||
      (el.matches('button, a, [role="button"], [role="radio"]') && rect.height < 48)
    // Cards are allowed only for the drawer, dialogs and popovers.
    const overlay = el.closest('[role="dialog"], [role="menu"], [role="tooltip"], [role="listbox"]')
    if (
      !control &&
      !overlay &&
      !insideLeaflet(el) &&
      (bordered || shadowed) &&
      radius > 0 &&
      bg &&
      bg.a > 0 &&
      el.parentElement &&
      style.backgroundColor !== effectiveBg(el.parentElement) &&
      rect.width >= 48 &&
      rect.height >= 32
    ) {
      cards.push(describe(el))
    }
    if (shadowed) {
      const layers = style.boxShadow
        .split(/,(?![^(]*\))/)
        .map((layer) => layer.trim())
        .filter((layer) => !/rgba\([^)]*,\s*0\)/.test(layer))
      for (const layer of layers) {
        // "color x y blur spread": a blur of 0 is a ring (an outline drawn with box-shadow).
        const lengths = layer
          .replace(/rgba?\([^)]*\)/, '')
          .trim()
          .split(/\s+/)
          .map(px)
        const target = (lengths[2] ?? 0) > 0 ? shadows : rings
        target.set(layer, (target.get(layer) ?? 0) + 1)
      }
    }
    if (/gradient\(/.test(style.backgroundImage)) gradientElements++
  }
  let gradientRules = 0
  for (const sheet of document.styleSheets) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of rules)
      if (/(linear|radial|conic)-gradient\(/.test(rule.cssText)) gradientRules++
  }

  // 7. Filled accent buttons visible in the first viewport.
  const primary = all.filter((el) => {
    if (!el.matches('button, a, [role="button"]')) return false
    const rect = el.getBoundingClientRect()
    return (
      rect.top < innerHeight && rect.bottom > 0 && ACCENT.has(getComputedStyle(el).backgroundColor)
    )
  })

  // 8. Interactive targets under 40px on mobile (hit area: the box, its ::after, or its label).
  const small = []
  if (mobile) {
    const selector =
      'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=slider]'
    for (const el of document.querySelectorAll(selector)) {
      if (!visible(el)) continue
      const style = getComputedStyle(el)
      if (el.tagName === 'A' && style.display === 'inline') continue // inline links in prose (WCAG 2.5.8)
      const rect = el.getBoundingClientRect()
      const after = getComputedStyle(el, '::after')
      // Inputs: their labels are part of the target, including a label's ::after hit area.
      const labelBoxes = el.tagName === 'INPUT' ? [...(el.labels ?? [])] : []
      const label = labelBoxes.length
        ? labelBoxes.reduce(
            (best, l) => {
              const box = l.getBoundingClientRect()
              const extra = getComputedStyle(l, '::after')
              const w = Math.max(box.width, extra.position === 'absolute' ? px(extra.width) : 0)
              const h = Math.max(box.height, extra.position === 'absolute' ? px(extra.height) : 0)
              return { width: Math.max(best.width, w), height: Math.max(best.height, h) }
            },
            { width: 0, height: 0 },
          )
        : null
      const width = Math.max(
        rect.width,
        after.position === 'absolute' ? px(after.width) : 0,
        label?.width ?? 0,
      )
      const height = Math.max(
        rect.height,
        after.position === 'absolute' ? px(after.height) : 0,
        label?.height ?? 0,
      )
      if (width < 40 || height < 40)
        small.push(`${Math.round(width)}x${Math.round(height)} ${describe(el)}`)
    }
  }

  // 9. Alignment: distinct left edges of the page's top-level blocks. The content container is
  // the first descendant of <main> with more than one visible child; its children and their
  // children are the blocks.
  let container = document.querySelector('main') ?? document.body
  for (;;) {
    const kids = [...container.children].filter(visible)
    if (kids.length !== 1) break
    container = kids[0]
  }
  const blocks = [...container.children]
    .filter(visible)
    .flatMap((child) => [child, ...[...child.children].filter(visible)])
  const edges = [
    ...new Set(
      blocks
        .filter((b) => b.getBoundingClientRect().width >= 40)
        .map((b) => Math.round(b.getBoundingClientRect().left)),
    ),
  ].sort((a, b) => a - b)

  const top = (map, n = 12) =>
    Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n))
  return {
    fontSizes: [...sizes.keys()].sort((a, b) => parseFloat(a) - parseFloat(b)),
    fontWeights: [...weights.keys()].sort(),
    fontFamilies: [...families.keys()],
    offGridSpacing: {
      count: [...offGrid.values()].reduce((s, n) => s + n, 0),
      values: top(offGrid),
    },
    pills: { count: pills.length, examples: [...new Set(pills)].slice(0, 10) },
    cards: { count: cards.length, examples: [...new Set(cards)].slice(0, 10) },
    gradients: { rules: gradientRules, elements: gradientElements },
    shadows: { distinct: shadows.size, values: top(shadows, 6), rings: top(rings, 6) },
    primaryButtons: { count: primary.length, examples: primary.map(describe) },
    contrastFailures: { count: contrast.length, examples: contrast.slice(0, 8) },
    smallTargets: { count: small.length, examples: small.slice(0, 10) },
    leftEdges: { count: edges.length, values: edges },
  }
}

async function runSteps(page, steps = []) {
  for (const step of steps) {
    if (step.upload)
      await page.locator('input[type=file]').setInputFiles(resolve(FRONTEND, step.upload))
    if (step.click) await page.getByRole('button', { name: step.click, exact: true }).click()
    if (step.waitForText)
      await page
        .getByText(step.waitForText)
        .first()
        .waitFor({ timeout: step.timeout ?? 10000 })
    if (step.press) await page.keyboard.press(step.press)
    if (step.wait) await page.waitForTimeout(step.wait)
  }
}

async function startServer() {
  // Sample-data mode regardless of .env: process variables win over .env files in Vite.
  process.env.VITE_USE_MOCK = 'true'
  process.env.VITE_DEMO_FAST = 'false'
  const { createServer } = await import('vite')
  const server = await createServer({
    root: FRONTEND,
    logLevel: 'error',
    server: { port: 5199, strictPort: false },
  })
  await server.listen()
  const url = server.resolvedUrls?.local?.[0]?.replace(/\/$/, '')
  return { server, base: url }
}

function summarise(result) {
  return {
    sizes: result.fontSizes.length,
    weights: result.fontWeights.length,
    families: result.fontFamilies.length,
    offGrid: result.offGridSpacing.count,
    pills: result.pills.count,
    cards: result.cards.count,
    gradients: result.gradients.rules + result.gradients.elements,
    shadows: result.shadows.distinct,
    primary: result.primaryButtons.count,
    contrast: result.contrastFailures.count,
    small: result.smallTargets.count,
    edges: result.leftEdges.count,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const routes = JSON.parse(await readFile(args.routes, 'utf-8')).filter(
    (r) => !args.only || args.only.includes(r.name),
  )
  const started = args.base ? null : await startServer()
  const base = args.base ?? started.base
  const browser = await chromium.launch()
  const results = []
  try {
    // Warm up: let Vite optimise dependencies before the first measured page.
    const warm = await browser.newPage()
    await warm.goto(`${base}/map`, { waitUntil: 'networkidle' })
    await warm.waitForTimeout(3000)
    await warm.close()

    for (const route of routes) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          isMobile: viewport.mobile,
          hasTouch: viewport.mobile,
          reducedMotion: 'reduce',
        })
        const page = await context.newPage()
        await page.goto(`${base}${route.path}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(2500)
        await runSteps(page, route.steps)
        const measured = await page.evaluate(measure, { mobile: viewport.mobile })
        if (args.shots) {
          await mkdir(args.shots, { recursive: true })
          await page.screenshot({
            path: resolve(args.shots, `${route.name}-${viewport.width}.png`),
            fullPage: route.fullPage !== false,
          })
        }
        results.push({
          route: route.name,
          path: route.path,
          viewport: viewport.name,
          width: viewport.width,
          ...measured,
        })
        await context.close()
      }
    }
  } finally {
    await browser.close()
    await started?.server.close()
  }

  const rows = results.map((r) => ({ route: r.route, vp: r.width, ...summarise(r) }))
  console.table(rows)
  // App-wide: the worst view, or the distinct values across all views for type and shadows.
  const worst = (key, subset = rows) => Math.max(...subset.map((r) => r[key]))
  const distinct = (pick) => new Set(results.flatMap(pick)).size
  const measured = {
    fontSizes: distinct((r) => r.fontSizes),
    fontWeights: distinct((r) => r.fontWeights),
    fontFamilies: distinct((r) => r.fontFamilies),
    offGridSpacing: worst('offGrid'),
    pills: worst('pills'),
    cards: worst('cards'),
    gradients: worst('gradients'),
    shadows: distinct((r) => Object.keys(r.shadows.values)),
    // "Exactly one per view": the number of views that miss it.
    primaryButtons: rows.filter((r) => r.primary !== TARGETS.primaryButtons).length,
    contrastFailures: worst('contrast'),
    smallTargets: worst(
      'small',
      rows.filter((r) => r.vp === 390),
    ),
    leftEdges: worst('edges'),
  }
  const verdicts = Object.fromEntries(
    Object.entries(measured).map(([key, value]) => [
      key,
      key === 'primaryButtons'
        ? { measured: `${value} views off 1`, target: 'exactly 1 per view', pass: value === 0 }
        : { measured: value, target: `<= ${TARGETS[key]}`, pass: value <= TARGETS[key] },
    ]),
  )
  console.log('\nApp-wide (worst route, or distinct across all routes for type and shadows):')
  console.table(verdicts)
  await mkdir(dirname(args.out), { recursive: true })
  await writeFile(
    args.out,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), targets: TARGETS, verdicts, results },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${args.out}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
