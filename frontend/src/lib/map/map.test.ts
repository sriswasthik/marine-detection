import { describe, expect, it } from 'vitest'
import tokensCss from '@/styles/tokens.css?raw'
import { DENSITY_LEVEL_IDS } from '@/features/observations/types'
import { CONFIDENCE_THRESHOLDS } from '@/lib/config'
import { DENSITY_LEVELS } from '@/lib/density'
import { formatLength } from '@/lib/format'
import { makeScene } from '@/test/geoFixtures'
import { BASEMAPS, CARTO_POSITRON, MAP_COLORS } from './basemaps'
import {
  DETECTION_FILL_OPACITY,
  DETECTION_STROKE_WEIGHT,
  EMPHASIS_FILL_BOOST,
  footprintLabel,
  getDensityCellStyle,
  getDetectionStyle,
  getFootprintStyle,
  getSelectionHaloStyle,
  HOVER_STROKE_WEIGHT,
  IMAGERY_FILL_OPACITY,
  IMAGERY_STROKE_WEIGHT,
  IMAGERY_LOW_CONFIDENCE_FILL_OPACITY,
  isLowConfidence,
  LOW_CONFIDENCE_DASH,
  LOW_CONFIDENCE_FILL_OPACITY,
  LOW_CONFIDENCE_STROKE_OPACITY,
  SELECTED_STROKE_WEIGHT,
} from './detectionStyle'
import {
  DEFAULT_VISIBLE_LAYERS,
  layerVisibilityReducer,
  MAP_LAYER_IDS,
  PREVIEW_VISIBLE_LAYERS,
} from './layers'
import {
  detectionRepresentation,
  geometryExtentM,
  metersPerPixel,
  MIN_POLYGON_PX,
} from './representation'
import {
  INITIAL_TILE_FAILURE_STATE,
  TILE_FAILURE_THRESHOLD,
  tileFailureReducer,
  type TileEvent,
} from './tileFailures'

const HIGH_CONFIDENCE = CONFIDENCE_THRESHOLDS.high
const LOW_CONFIDENCE = CONFIDENCE_THRESHOLDS.low - 0.01
const STATES = [false, true].flatMap((onImagery) => [
  { selected: false, hovered: false, onImagery },
  { selected: false, hovered: true, onImagery },
  { selected: true, hovered: false, onImagery },
  { selected: true, hovered: true, onImagery },
])

describe('getDetectionStyle', () => {
  const cases = DENSITY_LEVEL_IDS.flatMap((level) =>
    [HIGH_CONFIDENCE, CONFIDENCE_THRESHOLDS.low, LOW_CONFIDENCE].flatMap((confidence) =>
      STATES.map((state) => [level, confidence, state] as const),
    ),
  )

  it.each(cases)('%s at confidence %s with %o', (level, confidence, state) => {
    const style = getDetectionStyle({ densityLevel: level, confidence }, state)
    const meta = DENSITY_LEVELS[level]
    const low = confidence < CONFIDENCE_THRESHOLDS.low
    const base = state.onImagery
      ? low
        ? IMAGERY_LOW_CONFIDENCE_FILL_OPACITY
        : IMAGERY_FILL_OPACITY
      : low
        ? LOW_CONFIDENCE_FILL_OPACITY
        : DETECTION_FILL_OPACITY

    // Fill always encodes the density level.
    expect(style.fillColor).toBe(meta.color)
    expect(style.fill).toBe(true)
    // Confidence: dashed and lighter below the threshold, in every state.
    expect(style.dashArray).toBe(low ? LOW_CONFIDENCE_DASH : undefined)
    // Stroke: the Tar Black mark when selected, white over imagery, level stroke otherwise.
    expect(style.color).toBe(
      state.selected ? MAP_COLORS.mark : state.onImagery ? MAP_COLORS.halo : meta.stroke,
    )
    expect(style.opacity).toBe(low && !state.selected ? LOW_CONFIDENCE_STROKE_OPACITY : 1)
    // Weight: selected beats hovered beats default.
    expect(style.weight).toBe(
      state.selected
        ? SELECTED_STROKE_WEIGHT
        : state.hovered
          ? HOVER_STROKE_WEIGHT
          : state.onImagery
            ? IMAGERY_STROKE_WEIGHT
            : DETECTION_STROKE_WEIGHT,
    )
    expect(style.fillOpacity).toBeCloseTo(
      state.selected || state.hovered ? base + EMPHASIS_FILL_BOOST : base,
      10,
    )
  })

  it('treats the threshold itself as normal confidence', () => {
    expect(isLowConfidence(CONFIDENCE_THRESHOLDS.low)).toBe(false)
    expect(isLowConfidence(LOW_CONFIDENCE)).toBe(true)
  })

  it('draws a white, unfilled casing under selections', () => {
    expect(getSelectionHaloStyle()).toMatchObject({
      color: MAP_COLORS.casing,
      fill: false,
      fillOpacity: 0,
    })
    expect(getSelectionHaloStyle().weight).toBeGreaterThan(SELECTED_STROKE_WEIGHT)
  })

  it('keeps density cells lighter than detections', () => {
    for (const level of DENSITY_LEVEL_IDS) {
      const cell = getDensityCellStyle(level)
      expect(cell.fillColor).toBe(DENSITY_LEVELS[level].color)
      expect(cell.fillOpacity).toBeLessThan(LOW_CONFIDENCE_FILL_OPACITY)
      expect(getDensityCellStyle(level, true).fillOpacity).toBeGreaterThan(cell.fillOpacity)
      // Stronger over imagery, still lighter than detections there.
      const imagery = getDensityCellStyle(level, false, true)
      expect(imagery.fillOpacity).toBeGreaterThan(cell.fillOpacity)
      expect(imagery.fillOpacity).toBeLessThan(IMAGERY_LOW_CONFIDENCE_FILL_OPACITY)
    }
  })

  it('draws the footprint dashed, or dotted and relabelled when approximate', () => {
    expect(getFootprintStyle(false)).toMatchObject({ weight: 1, fill: false, dashArray: '6 4' })
    expect(getFootprintStyle(true).dashArray).toBe('1 4')
    expect(getFootprintStyle(false).color).toBe(MAP_COLORS.muted)
    expect(getFootprintStyle(false, true).color).toBe(MAP_COLORS.halo)
    expect(footprintLabel(false)).toBe('Source image footprint')
    expect(footprintLabel(true)).toBe('Approximate footprint')
  })

  it('mirrors the design tokens', () => {
    const css = tokensCss.toLowerCase()
    expect(css).toContain(`--color-tar: ${MAP_COLORS.mark.toLowerCase()};`)
    expect(css).toContain(`--color-ink-2: ${MAP_COLORS.muted.toLowerCase()};`)
    expect(css).toContain(`--color-map-fallback: ${MAP_COLORS.fallback.toLowerCase()};`)
  })
})

describe('zoom-adaptive representation', () => {
  it('matches the Web Mercator ground resolution', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156_543.03, 1)
    expect(metersPerPixel(1, 0)).toBeCloseTo(metersPerPixel(0, 0) / 2, 6)
    expect(metersPerPixel(10, 60)).toBeCloseTo(metersPerPixel(10, 0) / 2, 6)
  })

  it('switches to a point below the pixel threshold', () => {
    const lat = 13.22
    // A 60 m streak at zoom z spans 60 / metersPerPixel(z) pixels.
    const spans = (zoom: number) => 60 / metersPerPixel(zoom, lat)
    const smallZoom = [...Array(23).keys()].find((z) => spans(z) >= MIN_POLYGON_PX) ?? 22
    expect(detectionRepresentation(60, lat, smallZoom - 1)).toBe('point')
    expect(detectionRepresentation(60, lat, smallZoom)).toBe('polygon')
    expect(detectionRepresentation(60, lat, 22)).toBe('polygon')
    expect(detectionRepresentation(60, lat, 3)).toBe('point')
  })

  it('treats exactly the threshold as a polygon', () => {
    const extent = MIN_POLYGON_PX * metersPerPixel(15, 10)
    expect(detectionRepresentation(extent, 10, 15)).toBe('polygon')
    expect(detectionRepresentation(extent * 0.99, 10, 15)).toBe('point')
  })

  it('measures the longest side of a detection', () => {
    const scene = makeScene(1000, 500)
    const streak = scene.polygon(scene.rect(100, 100, 400, 150))
    expect(geometryExtentM(streak)).toBeCloseTo(300, 0)
  })
})

describe('layer visibility reducer', () => {
  it('starts with detections, hotspots and footprint on', () => {
    expect(DEFAULT_VISIBLE_LAYERS).toEqual({
      detections: true,
      density: false,
      hotspots: true,
      footprint: true,
    })
    expect(PREVIEW_VISIBLE_LAYERS).toEqual({
      detections: true,
      density: false,
      hotspots: true,
      footprint: false,
    })
  })

  it('toggles each layer independently', () => {
    for (const layer of MAP_LAYER_IDS) {
      const next = layerVisibilityReducer(DEFAULT_VISIBLE_LAYERS, { type: 'toggle', layer })
      expect(next[layer]).toBe(!DEFAULT_VISIBLE_LAYERS[layer])
      for (const other of MAP_LAYER_IDS.filter((l) => l !== layer)) {
        expect(next[other]).toBe(DEFAULT_VISIBLE_LAYERS[other])
      }
    }
  })

  it('sets explicitly, keeping the same object when nothing changes', () => {
    const on = layerVisibilityReducer(DEFAULT_VISIBLE_LAYERS, {
      type: 'set',
      layer: 'density',
      visible: true,
    })
    expect(on.density).toBe(true)
    expect(layerVisibilityReducer(on, { type: 'set', layer: 'density', visible: true })).toBe(on)
  })

  it('resets to the defaults', () => {
    const changed = layerVisibilityReducer(DEFAULT_VISIBLE_LAYERS, {
      type: 'toggle',
      layer: 'detections',
    })
    expect(layerVisibilityReducer(changed, { type: 'reset' })).toEqual(DEFAULT_VISIBLE_LAYERS)
  })
})

describe('tile failure counter', () => {
  const run = (events: TileEvent[]) => events.reduce(tileFailureReducer, INITIAL_TILE_FAILURE_STATE)
  const errors = (n: number): TileEvent[] =>
    Array.from({ length: n }, () => ({ type: 'tileerror' }))

  it('tolerates a few failed tiles', () => {
    const state = run(errors(TILE_FAILURE_THRESHOLD - 1))
    expect(state.unavailable).toBe(false)
    expect(state.consecutiveErrors).toBe(TILE_FAILURE_THRESHOLD - 1)
  })

  it('marks the basemap unavailable after a run of failures', () => {
    expect(run(errors(TILE_FAILURE_THRESHOLD)).unavailable).toBe(true)
  })

  it('resets the run when a tile loads in between', () => {
    const state = run([
      ...errors(TILE_FAILURE_THRESHOLD - 1),
      { type: 'tileload' },
      ...errors(TILE_FAILURE_THRESHOLD - 1),
    ])
    expect(state.unavailable).toBe(false)
    expect(state.loadedTiles).toBe(1)
  })

  it('recovers when tiles start loading again, and resets fully', () => {
    const failed = run(errors(TILE_FAILURE_THRESHOLD + 3))
    expect(failed.unavailable).toBe(true)
    expect(tileFailureReducer(failed, { type: 'tileload' }).unavailable).toBe(false)
    expect(tileFailureReducer(failed, { type: 'reset' })).toEqual(INITIAL_TILE_FAILURE_STATE)
  })
})

describe('basemaps and lengths', () => {
  it('uses the specified providers and attributions', () => {
    // CARTO needs an API key now; the light basemap is Esri Light Gray Canvas until one is set.
    expect(BASEMAPS.light.url).toContain('World_Light_Gray_Base')
    expect(BASEMAPS.light.attribution).toBe('Tiles © Esri')
    expect(CARTO_POSITRON.url).toContain('basemaps.cartocdn.com/light_all')
    expect(CARTO_POSITRON.attribution).toBe('© OpenStreetMap contributors © CARTO')
    expect(BASEMAPS.satellite.url).toContain('World_Imagery')
    expect(BASEMAPS.satellite.attribution).toBe('Tiles © Esri')
  })

  it('formats lengths for the legend', () => {
    expect(formatLength(250)).toBe('250 m')
    expect(formatLength(2.5)).toBe('2.5 m')
    expect(formatLength(1200)).toBe('1.2 km')
    expect(formatLength(25_000)).toBe('25 km')
    expect(formatLength(null)).toBe('—')
    expect(formatLength(-1)).toBe('—')
  })
})
