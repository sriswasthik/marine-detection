import { expect, test, type Page } from '@playwright/test'

/**
 * The Map page's layout rules (docs/MAP_CLEANUP.md), measured in a real browser at four sizes:
 * no piece of chrome overlaps another, all of it is inside the viewport, the attribution is fully
 * visible, at most two overlays sit inside the map and inside its frame, every toolbar control is
 * the same height, and the page shows exactly one primary button.
 */

const SIZES = [
  { width: 1440, height: 900, mobile: false },
  { width: 1280, height: 720, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 390, height: 844, mobile: true },
] as const

const STATES = [
  { name: 'hotspot 1 selected', path: '/map/obs-ennore-20261003?h=hotspot-1', drawer: true },
  { name: 'nothing selected', path: '/map/obs-ennore-20261003', drawer: false },
] as const

interface Box {
  chrome: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

/** Bounding boxes of every visible [data-chrome] element. */
async function chromeBoxes(page: Page): Promise<Box[]> {
  return page.locator('[data-chrome]').evaluateAll((elements) =>
    elements
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          chrome: el.getAttribute('data-chrome') ?? '',
          label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        }
      })
      .filter((b) => b.width > 0 && b.height > 0),
  )
}

const TOLERANCE = 0.5

function intersects(a: Box, b: Box): boolean {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > TOLERANCE && h > TOLERANCE
}

for (const size of SIZES) {
  test.describe(`Map page at ${size.width}x${size.height}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      isMobile: size.mobile,
      hasTouch: size.mobile,
    })

    for (const state of STATES) {
      test(`keeps its chrome in order with ${state.name}`, async ({ page }) => {
        await page.goto(state.path)
        await page.locator('.leaflet-container').waitFor()
        await page.locator('[data-chrome="toolbar"]').waitFor()
        if (state.drawer) await page.locator('[data-chrome="drawer"]').waitFor()
        // Let the map settle into its frame.
        await page.waitForTimeout(800)

        const boxes = await chromeBoxes(page)
        expect(boxes.map((b) => b.chrome)).toEqual(
          expect.arrayContaining(['toolbar', 'status', 'overlay']),
        )

        // 1. No two pieces of chrome intersect.
        const collisions: string[] = []
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i] as Box
            const b = boxes[j] as Box
            if (intersects(a, b))
              collisions.push(`${a.chrome} "${a.label}" x ${b.chrome} "${b.label}"`)
          }
        }
        expect(collisions).toEqual([])

        // 2. Everything is inside the viewport.
        for (const box of boxes) {
          expect(box.x, `${box.chrome} left`).toBeGreaterThanOrEqual(-TOLERANCE)
          expect(box.y, `${box.chrome} top`).toBeGreaterThanOrEqual(-TOLERANCE)
          expect(box.x + box.width, `${box.chrome} right`).toBeLessThanOrEqual(
            size.width + TOLERANCE,
          )
          expect(box.y + box.height, `${box.chrome} bottom`).toBeLessThanOrEqual(
            size.height + TOLERANCE,
          )
        }

        // 3. The attribution is fully visible.
        const attribution = page.locator('[data-attribution]')
        await expect(attribution).toBeVisible()
        const attributionFit = await attribution.evaluate((el) => {
          const r = el.getBoundingClientRect()
          const strip = el.closest('[data-chrome]')?.getBoundingClientRect()
          return {
            unclipped: el.scrollWidth <= el.clientWidth + 1,
            inViewport: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            inStrip: strip ? r.left >= strip.left && r.right <= strip.right + 0.5 : false,
            text: el.textContent ?? '',
          }
        })
        expect(attributionFit).toMatchObject({ unclipped: true, inViewport: true, inStrip: true })
        expect(attributionFit.text.length).toBeGreaterThan(0)

        // 4. At most two overlays, each inside the map frame.
        const canvas = await page.locator('[data-map-canvas]').boundingBox()
        expect(canvas).not.toBeNull()
        const overlays = boxes.filter((b) => b.chrome === 'overlay')
        expect(overlays.length).toBeLessThanOrEqual(2)
        for (const overlay of overlays) {
          if (!canvas) break
          expect(overlay.x).toBeGreaterThanOrEqual(canvas.x)
          expect(overlay.y).toBeGreaterThanOrEqual(canvas.y)
          expect(overlay.x + overlay.width).toBeLessThanOrEqual(canvas.x + canvas.width + TOLERANCE)
          expect(overlay.y + overlay.height).toBeLessThanOrEqual(
            canvas.y + canvas.height + TOLERANCE,
          )
        }

        // 5. Every toolbar control is the same height.
        const heights = await page
          .locator('[data-chrome="toolbar"] [data-toolbar-control]')
          .evaluateAll((els) =>
            els
              .map((el) => el.getBoundingClientRect())
              .filter((r) => r.width > 0)
              .map((r) => Math.round(r.height)),
          )
        expect(heights.length).toBeGreaterThan(1)
        expect(new Set(heights).size, `toolbar heights ${heights.join(', ')}`).toBe(1)

        // 6. Exactly one primary button: the Tar Black fill of the accent token.
        const primaries = await page.locator('a, button').evaluateAll((els) => {
          const accent = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-accent')
            .trim()
          const probe = document.createElement('span')
          probe.style.color = accent
          document.body.appendChild(probe)
          const accentRgb = getComputedStyle(probe).color
          probe.remove()
          return els.filter((el) => {
            const r = el.getBoundingClientRect()
            return (
              r.width > 0 &&
              r.height > 0 &&
              r.bottom > 0 &&
              r.top < innerHeight &&
              getComputedStyle(el).backgroundColor === accentRgb
            )
          }).length
        })
        expect(primaries).toBe(1)
      })
    }
  })
}
