#!/usr/bin/env node
/**
 * Map page screenshots and chrome measurements at four sizes, for the map cleanup
 * (docs/MAP_CLEANUP.md). Starts its own Vite dev server in sample-data mode.
 *
 *   node scripts/map-shots.mjs --out ../docs/design/map-before
 *
 * Writes <size>.png (hotspot 1 selected), <size>-idle.png (nothing selected),
 * satellite-1440.png and boxes.json: every visible box drawn over or around the map, with its
 * bounding box, and every pair of boxes that intersect.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(HERE, '..')
const SIZES = [
  { name: '1440x900', width: 1440, height: 900, mobile: false },
  { name: '1280x720', width: 1280, height: 720, mobile: false },
  { name: '1024x768', width: 1024, height: 768, mobile: false },
  { name: '390x844', width: 390, height: 844, mobile: true },
]
const OBSERVATION = 'obs-ennore-20261003'

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

/** Runs in the page: the boxes a person sees as separate pieces of map chrome. */
function measureBoxes() {
  const main = document.querySelector('main')
  const map = document.querySelector('.leaflet-container')
  const inLeafletPane = (el) => Boolean(el.closest('.leaflet-pane'))
  const visible = (el) => {
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0)
      return false
    const r = el.getBoundingClientRect()
    return r.width > 4 && r.height > 4
  }
  const framed = (s) =>
    ['Top', 'Right', 'Bottom', 'Left'].some((side) => parseFloat(s[`border${side}Width`]) > 0) ||
    (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent')
  const label = (el) =>
    (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48)
  const boxes = []
  // The map region: the page's outermost element inside <main>.
  const root = main.querySelector(':scope > * > *') ?? main
  for (const el of root.querySelectorAll('*')) {
    if (!visible(el) || inLeafletPane(el) || el === map || el.contains(map)) continue
    const s = getComputedStyle(el)
    const attribution = el.classList.contains('leaflet-control-attribution')
    // A box is a framed element (border or fill) or the attribution; marked chrome counts too.
    if (!(attribution || framed(s) || el.hasAttribute('data-chrome'))) continue
    // Only the outermost box counts: its children belong to it.
    if (boxes.some((b) => b.el.contains(el))) continue
    if (
      el.closest('.leaflet-container') &&
      !el.closest('.leaflet-control-container') &&
      !attribution
    )
      continue
    const r = el.getBoundingClientRect()
    boxes.push({ el, label: label(el), x: r.x, y: r.y, width: r.width, height: r.height })
  }
  // Drawer (fixed, outside main).
  for (const el of document.querySelectorAll('[role="dialog"]')) {
    if (!visible(el) || boxes.some((b) => b.el === el || b.el.contains(el))) continue
    const r = el.getBoundingClientRect()
    boxes.push({
      el,
      label: `drawer: ${label(el)}`,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    })
  }
  const intersections = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (w > 0.5 && h > 0.5)
        intersections.push({ a: a.label, b: b.label, overlap: `${Math.round(w)}x${Math.round(h)}` })
    }
  }
  const attribution = document.querySelector('.leaflet-control-attribution')
  const attributionBox = attribution?.getBoundingClientRect()
  const clipped =
    attribution && attributionBox
      ? attribution.scrollWidth > attribution.clientWidth + 1 ||
        attributionBox.right > innerWidth ||
        attributionBox.bottom > innerHeight
      : null
  // Text sizes inside the map region.
  const sizes = new Set()
  const region = map?.parentElement?.parentElement ?? main
  for (const el of region.querySelectorAll('*')) {
    if (!visible(el) || inLeafletPane(el)) continue
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      sizes.add(getComputedStyle(el).fontSize)
  }
  return {
    viewport: `${innerWidth}x${innerHeight}`,
    boxCount: boxes.length,
    boxes: boxes.map(({ el: _el, ...rest }) => ({
      ...rest,
      x: Math.round(rest.x),
      y: Math.round(rest.y),
      width: Math.round(rest.width),
      height: Math.round(rest.height),
    })),
    intersections,
    attribution: attributionBox
      ? {
          text: attribution.textContent,
          right: Math.round(attributionBox.right),
          bottom: Math.round(attributionBox.bottom),
          clipped,
        }
      : null,
    textSizes: [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b)),
  }
}

async function main() {
  const out = resolve(process.cwd(), arg('--out', '../docs/design/map-before'))
  await mkdir(out, { recursive: true })
  process.env.VITE_USE_MOCK = 'true'
  process.env.VITE_DEMO_FAST = 'false'
  const { createServer } = await import('vite')
  const server = await createServer({
    root: FRONTEND,
    server: { port: 5197, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()
  const base = 'http://localhost:5197'
  const browser = await chromium.launch()
  const report = {}
  try {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.mobile,
        hasTouch: size.mobile,
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      for (const [suffix, path] of [
        ['', `/map/${OBSERVATION}?h=hotspot-1`],
        ['-idle', `/map/${OBSERVATION}`],
      ]) {
        await page.goto(base + path)
        await page.waitForSelector('.leaflet-container', { timeout: 20000 })
        await page.waitForTimeout(2500)
        await page.screenshot({ path: resolve(out, `${size.name}${suffix}.png`) })
        report[`${size.name}${suffix}`] = await page.evaluate(measureBoxes)
      }
      if (size.width === 1440) {
        await page.goto(`${base}/map/${OBSERVATION}?bm=satellite`)
        await page.waitForSelector('.leaflet-container', { timeout: 20000 })
        await page.waitForTimeout(3500)
        await page.screenshot({ path: resolve(out, 'satellite-1440.png') })
      }
      await context.close()
    }
  } finally {
    await browser.close()
    await server.close()
  }
  await writeFile(resolve(out, 'boxes.json'), JSON.stringify(report, null, 2))
  for (const [name, r] of Object.entries(report)) {
    console.log(
      `${name.padEnd(14)} boxes ${String(r.boxCount).padStart(2)}  overlaps ${String(r.intersections.length).padStart(2)}  attribution clipped ${r.attribution?.clipped}  text sizes ${r.textSizes.join(' ')}`,
    )
  }
}

await main()
