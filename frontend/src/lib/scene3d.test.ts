import { describe, expect, it } from 'vitest'
import { computeDensityGrid } from './density'
import {
  angularDistance,
  beamHeight,
  globeFocus,
  globeMarkers,
  globeSamplePositions,
  latLngToVector3,
  orbitPosition,
  orbitRadius,
  pipelinePhase,
  RELIEF_MAX_HEIGHT,
  reliefBars,
  reliefExtent,
  reliefPosition,
  SENTINEL2,
  SPECTRAL_BANDS,
  swathHalfAngle,
  vector3ToLatLng,
} from './scene3d'

const bounds = { north: 13.3, south: 13.2, east: 80.4, west: 80.3 }

describe('globe projection', () => {
  it('puts the poles on the y axis and longitude 0 on +x', () => {
    const [nx, ny, nz] = latLngToVector3(90, 0)
    expect(ny).toBeCloseTo(1, 10)
    expect(Math.hypot(nx, nz)).toBeCloseTo(0, 10)
    const [x, y, z] = latLngToVector3(0, 0, 2)
    expect([x, y, z].map((v) => Number(v.toFixed(10)))).toEqual([2, 0, 0])
    expect(latLngToVector3(0, 90)[2]).toBeCloseTo(-1, 10)
  })

  it('round-trips latitude and longitude', () => {
    for (const [lat, lng] of [
      [13.2, 80.3],
      [-33.9, 151.2],
      [51.5, -0.1],
      [0, 179.5],
      [-60, -120],
    ] as const) {
      const back = vector3ToLatLng(latLngToVector3(lat, lng, 1.7))
      expect(back.lat).toBeCloseTo(lat, 8)
      expect(back.lng).toBeCloseTo(lng, 8)
    }
  })

  it('samples the globe evenly, thinning towards the poles', () => {
    const points = globeSamplePositions(10)
    const equator = points.filter((p) => Math.abs(p.lat) <= 5).length
    const polar = points.filter((p) => Math.abs(p.lat) > 80).length
    expect(equator).toBeGreaterThan(polar)
    expect(points.every((p) => p.lng >= -180 && p.lng <= 180 && Math.abs(p.lat) < 90)).toBe(true)
    expect(() => globeSamplePositions(0)).toThrow(RangeError)
  })
})

describe('Sentinel-2 orbit', () => {
  it('sits 786 km up', () => {
    expect(orbitRadius()).toBeCloseTo(1 + 786 / 6371, 10)
  })

  it('keeps the orbit radius and reaches beyond 81 degrees of latitude', () => {
    const radius = orbitRadius()
    let maxLat = 0
    for (let i = 0; i < 360; i++) {
      const p = orbitPosition((i * Math.PI) / 180, radius, SENTINEL2.inclinationDeg, 40)
      expect(Math.hypot(...p)).toBeCloseTo(radius, 10)
      maxLat = Math.max(maxLat, vector3ToLatLng(p).lat)
    }
    // A 98.62 degree inclination reaches 180 - 98.62 = 81.38 degrees.
    expect(maxLat).toBeCloseTo(180 - SENTINEL2.inclinationDeg, 1)
  })

  it('sees a 290 km swath from 786 km as about 10 degrees either side', () => {
    expect((swathHalfAngle() * 180) / Math.PI).toBeCloseTo(10.45, 1)
  })
})

describe('globe markers', () => {
  it('places one marker per observation with bounds, at the image centre', () => {
    const markers = globeMarkers([
      { id: 'a', region: 'Ennore', bounds, densityLevel: 'high', detectionCount: 60 },
      { id: 'b', region: 'Unknown', bounds: null, densityLevel: null, detectionCount: 0 },
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ id: 'a', level: 'high', detectionCount: 60 })
    expect(markers[0]!.lat).toBeCloseTo(13.25, 10)
    expect(markers[0]!.lng).toBeCloseTo(80.35, 10)
  })

  it('grows the beam with the detection count, slowly', () => {
    expect(beamHeight(0)).toBeGreaterThan(0)
    expect(beamHeight(100)).toBeGreaterThan(beamHeight(10))
    expect(beamHeight(1000) / beamHeight(10)).toBeLessThan(4)
    expect(beamHeight(-5)).toBe(beamHeight(0))
  })

  it('focuses on the markers, or the Indian Ocean without any', () => {
    expect(globeFocus([])).toEqual({ lat: 12, lng: 78 })
    const focus = globeFocus([
      { lat: 10, lng: 179 },
      { lat: 10, lng: -179 },
    ])
    expect(Math.abs(focus.lng)).toBeCloseTo(180, 5)
    expect(focus.lat).toBeCloseTo(10, 1)
  })

  it('turns to the densest cluster, not the empty middle of two continents', () => {
    const focus = globeFocus([
      { lat: 13.2, lng: 80.3 },
      { lat: 19.0, lng: 72.8 },
      { lat: 9.6, lng: 76.3 },
      { lat: 15.8, lng: -88.0 },
    ])
    expect(focus.lng).toBeGreaterThan(70)
    expect(focus.lng).toBeLessThan(82)
    expect(angularDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 90 })).toBeCloseTo(90, 8)
  })
})

describe('spectral bands', () => {
  it('lists the 11 model bands in input order', () => {
    expect(SPECTRAL_BANDS).toHaveLength(11)
    expect(SPECTRAL_BANDS.map((b) => b.wavelengthNm)).toEqual([
      440, 490, 560, 665, 705, 740, 783, 842, 865, 1600, 2200,
    ])
    expect(SPECTRAL_BANDS[8]?.name).toBe('B8A')
    expect(SPECTRAL_BANDS[0]?.region).toBe('Visible')
    expect(SPECTRAL_BANDS[10]?.region).toBe('Shortwave infrared')
  })
})

describe('density relief', () => {
  // 1000 m x 500 m at 250 m cells: 4 columns, 2 rows; one dense square in the south-west cell.
  const grid = computeDensityGrid(
    [
      {
        id: 'd1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [80.3, 13.2],
              [80.3011, 13.2],
              [80.3011, 13.2011],
              [80.3, 13.2011],
              [80.3, 13.2],
            ],
          ],
        },
      },
    ],
    { south: 13.2, west: 80.3, north: 13.2045, east: 80.30924 },
    250,
  )

  it('makes one bar per cell holding debris, inside the square', () => {
    const bars = reliefBars(grid)
    expect(bars.length).toBeGreaterThan(0)
    expect(bars.length).toBe(grid.cells.filter((c) => c.level).length)
    for (const bar of bars) {
      expect(Math.abs(bar.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(bar.z)).toBeLessThanOrEqual(1)
      expect(bar.height).toBeGreaterThan(0)
      expect(bar.height).toBeLessThanOrEqual(RELIEF_MAX_HEIGHT)
    }
  })

  it('keeps the grid aspect and puts the south-west corner at front left', () => {
    const extent = reliefExtent({ rows: 2, cols: 4 })
    expect(extent).toEqual({ width: 2, depth: 1 })
    const sw = reliefPosition({ lat: 13.2, lng: 80.3 }, bounds, { rows: 2, cols: 4 })
    expect(sw.x).toBeCloseTo(-1, 10)
    expect(sw.z).toBeCloseTo(0.5, 10)
  })

  it('scales bar height with the square root of coverage', () => {
    const [a, b] = reliefBars({
      rows: 1,
      cols: 2,
      cells: [
        { ...grid.cells[0]!, row: 0, col: 0, level: 'low', coveragePercent: 25 },
        { ...grid.cells[0]!, id: 'r0c1', row: 0, col: 1, level: 'critical', coveragePercent: 100 },
      ],
    })
    expect(a!.height).toBeCloseTo(RELIEF_MAX_HEIGHT / 2, 10)
    expect(b!.height).toBeCloseTo(RELIEF_MAX_HEIGHT, 10)
    expect(a!.x).toBeLessThan(b!.x)
  })
})

describe('pipeline phase', () => {
  const all = (state: 'pending' | 'done') =>
    ({ upload: state, preprocess: state, detect: state, map: state }) as const

  it('follows the active step', () => {
    expect(pipelinePhase(all('pending'))).toBe('idle')
    expect(pipelinePhase({ ...all('pending'), upload: 'active' })).toBe('upload')
    expect(
      pipelinePhase({ upload: 'done', preprocess: 'done', detect: 'active', map: 'pending' }),
    ).toBe('detect')
    expect(pipelinePhase(all('done'))).toBe('done')
  })

  it('shows a failure whatever else is going on', () => {
    expect(
      pipelinePhase({ upload: 'done', preprocess: 'failed', detect: 'pending', map: 'pending' }),
    ).toBe('failed')
  })
})
