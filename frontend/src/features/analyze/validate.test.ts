import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, MIN_IMAGE_PX } from '@/lib/config'
import {
  EMPTY_BOUNDS_INPUT,
  estimateResolutionM,
  fileKind,
  qualityChecks,
  runReadiness,
  validateBounds,
  validateDimensions,
  validateFile,
  type FileInspection,
  type QualityCheck,
} from './validate'

const facts = (name: string, type = '', size = 1024) => ({ name, type, size })

const inspection = (patch: Partial<FileInspection> = {}): FileInspection => ({
  kind: 'png',
  width: 1000,
  height: 800,
  georeferenced: false,
  embeddedBounds: null,
  epsg: null,
  resolutionM: null,
  previewUrl: null,
  readError: null,
  ...patch,
})

const VALID_BOUNDS = { north: '13.243', south: '13.197', east: '80.396', west: '80.34' }

describe('fileKind and validateFile', () => {
  it('recognises supported extensions, case-insensitively', () => {
    expect(fileKind(facts('scene.tif'))).toBe('geotiff')
    expect(fileKind(facts('scene.TIFF', 'image/tiff'))).toBe('geotiff')
    expect(fileKind(facts('scene.png', 'image/png'))).toBe('png')
    expect(fileKind(facts('scene.JPG', 'image/jpeg'))).toBe('jpeg')
    expect(fileKind(facts('scene.jpeg'))).toBe('jpeg')
  })

  it('refuses other extensions and contradicting MIME types', () => {
    expect(fileKind(facts('scene.bmp', 'image/bmp'))).toBeNull()
    expect(fileKind(facts('scene'))).toBeNull()
    expect(fileKind(facts('scene.png', 'application/pdf'))).toBeNull()
    expect(validateFile(facts('scene.bmp'))[0]).toMatchObject({ code: 'UNSUPPORTED_FORMAT' })
    expect(validateFile(facts('scene'))[0]?.message).toMatch(/no extension/)
  })

  it('applies the size limit at its boundary', () => {
    expect(validateFile(facts('scene.tif', '', MAX_UPLOAD_BYTES))).toEqual([])
    expect(validateFile(facts('scene.tif', '', MAX_UPLOAD_BYTES + 1))[0]).toMatchObject({
      code: 'TOO_LARGE',
    })
    expect(validateFile(facts('scene.tif', '', 0))[0]).toMatchObject({ code: 'EMPTY_FILE' })
  })

  it('reports several problems at once', () => {
    const codes = validateFile(facts('scene.gif', '', MAX_UPLOAD_BYTES * 2)).map((i) => i.code)
    expect(codes).toEqual(['UNSUPPORTED_FORMAT', 'TOO_LARGE'])
  })
})

describe('validateDimensions', () => {
  it('accepts the minimum and refuses one pixel less on either side', () => {
    expect(validateDimensions(MIN_IMAGE_PX, MIN_IMAGE_PX)).toBeNull()
    expect(validateDimensions(MIN_IMAGE_PX - 1, 4000)?.code).toBe('TOO_SMALL')
    expect(validateDimensions(4000, MIN_IMAGE_PX - 1)?.message).toContain(`${MIN_IMAGE_PX - 1}`)
  })
})

describe('validateBounds', () => {
  it('accepts valid bounds', () => {
    const result = validateBounds(VALID_BOUNDS)
    expect(result.errors).toEqual({})
    expect(result.bounds).toEqual({ north: 13.243, south: 13.197, east: 80.396, west: 80.34 })
    expect(result.empty).toBe(false)
  })

  it('asks for every missing value', () => {
    const result = validateBounds(EMPTY_BOUNDS_INPUT)
    expect(result.bounds).toBeNull()
    expect(result.empty).toBe(true)
    expect(Object.keys(result.errors).sort()).toEqual(['east', 'north', 'south', 'west'])
  })

  it('accepts the latitude and longitude limits inclusively', () => {
    expect(
      validateBounds({ north: '90', south: '-90', east: '180', west: '-180' }).bounds,
    ).not.toBeNull()
  })

  it('refuses values just outside the limits', () => {
    const result = validateBounds({ north: '90.0001', south: '-91', east: '180.5', west: '-181' })
    expect(result.errors.north).toBe('Latitude must be between -90 and 90.')
    expect(result.errors.south).toBe('Latitude must be between -90 and 90.')
    expect(result.errors.east).toBe('Longitude must be between -180 and 180.')
    expect(result.errors.west).toBe('Longitude must be between -180 and 180.')
  })

  it('requires north above south and east of west, equal values included', () => {
    expect(validateBounds({ ...VALID_BOUNDS, north: '13.197' }).errors.north).toBe(
      'North must be greater than south.',
    )
    expect(validateBounds({ ...VALID_BOUNDS, east: '80.30' }).errors.east).toBe(
      'East must be greater than west.',
    )
  })

  it('explains non-numeric input', () => {
    for (const value of ['abc', '13,2', '1e3', '--1', '.']) {
      expect(validateBounds({ ...VALID_BOUNDS, north: value }).errors.north).toMatch(
        /decimal degrees/,
      )
    }
    expect(validateBounds({ ...VALID_BOUNDS, west: ' -80.5 ' }).errors.west).toBeUndefined()
  })
})

describe('qualityChecks', () => {
  const status = (checks: QualityCheck[], id: QualityCheck['id']) =>
    checks.find((c) => c.id === id)?.status

  it('passes a georeferenced GeoTIFF', () => {
    const bounds = validateBounds(VALID_BOUNDS)
    const checks = qualityChecks({
      facts: facts('s2.tif', 'image/tiff'),
      inspection: inspection({
        kind: 'geotiff',
        georeferenced: true,
        embeddedBounds: bounds.bounds,
        epsg: 32644,
        resolutionM: 10,
      }),
      inspecting: false,
      bounds,
    })
    expect(checks.map((c) => c.id)).toEqual([
      'format',
      'dimensions',
      'georeferencing',
      'cloud',
      'resolution',
    ])
    expect(status(checks, 'georeferencing')).toBe('pass')
    expect(checks.find((c) => c.id === 'georeferencing')?.detail).toContain('EPSG:32644')
    expect(status(checks, 'resolution')).toBe('pass')
    expect(status(checks, 'cloud')).toBe('pending')
  })

  it('fails a PNG without bounds and says how to fix it', () => {
    const checks = qualityChecks({
      facts: facts('photo.png', 'image/png'),
      inspection: inspection(),
      inspecting: false,
      bounds: validateBounds(EMPTY_BOUNDS_INPUT),
    })
    const geo = checks.find((c) => c.id === 'georeferencing')
    expect(geo?.status).toBe('fail')
    expect(geo?.fix).toMatch(/north, south, east and west/)
  })

  it('estimates resolution from typed bounds', () => {
    const bounds = validateBounds(VALID_BOUNDS)
    const checks = qualityChecks({
      facts: facts('photo.png', 'image/png'),
      inspection: inspection({ width: 600 }),
      inspecting: false,
      bounds,
    })
    expect(status(checks, 'georeferencing')).toBe('pass')
    expect(checks.find((c) => c.id === 'resolution')?.detail).toMatch(/estimated from the bounds/)
    expect(estimateResolutionM(bounds.bounds ?? VALID_BOUNDS_GEO, 600)).toBeCloseTo(10, 0)
  })

  it('grades resolution as pass, warning or fail', () => {
    const grade = (resolutionM: number) =>
      status(
        qualityChecks({
          facts: facts('s.tif'),
          inspection: inspection({ resolutionM }),
          inspecting: false,
          bounds: validateBounds(VALID_BOUNDS),
        }),
        'resolution',
      )
    expect(grade(10)).toBe('pass')
    expect(grade(30)).toBe('warning')
    expect(grade(60)).toBe('warning')
    expect(grade(61)).toBe('fail')
  })

  it('shows dimensions as pending, unknown or too small', () => {
    const dims = (patch: Partial<FileInspection> | null, inspecting = false) =>
      qualityChecks({
        facts: facts('p.png'),
        inspection: patch === null ? null : inspection(patch),
        inspecting,
        bounds: validateBounds(VALID_BOUNDS),
      }).find((c) => c.id === 'dimensions')
    expect(dims(null, true)?.status).toBe('pending')
    expect(dims({ width: null, height: null })?.status).toBe('warning')
    expect(dims({ width: 64, height: 64 })?.status).toBe('fail')
    expect(dims({ width: 1000, height: 800 })?.detail).toBe('1000 × 800 pixels')
  })

  it('fails an unsupported GeoTIFF coordinate system until bounds are typed', () => {
    const geo = (bounds: typeof VALID_BOUNDS | typeof EMPTY_BOUNDS_INPUT) =>
      qualityChecks({
        facts: facts('s.tif'),
        inspection: inspection({ kind: 'geotiff', georeferenced: true, epsg: 27700 }),
        inspecting: false,
        bounds: validateBounds(bounds),
      }).find((c) => c.id === 'georeferencing')
    expect(geo(EMPTY_BOUNDS_INPUT)?.detail).toContain('EPSG:27700')
    expect(geo(VALID_BOUNDS)?.status).toBe('pass')
  })
})

const VALID_BOUNDS_GEO = { north: 13.243, south: 13.197, east: 80.396, west: 80.34 }

describe('runReadiness', () => {
  const pass: QualityCheck = { id: 'format', label: 'Format', status: 'pass', detail: 'PNG' }
  const base = {
    hasFile: true,
    inspecting: false,
    checks: [pass],
    region: 'Ennore',
    capturedAtIso: '2026-10-03T05:00:00Z',
  }

  it('is ready when everything is in place', () => {
    expect(runReadiness(base)).toEqual({ ready: true, reason: null })
  })

  it('explains the first blocker, in order', () => {
    expect(runReadiness({ ...base, hasFile: false }).reason).toMatch(/Choose an image/)
    expect(runReadiness({ ...base, inspecting: true }).reason).toMatch(/Reading the file/)
    expect(
      runReadiness({
        ...base,
        checks: [
          {
            ...pass,
            id: 'georeferencing',
            label: 'Georeferencing',
            status: 'fail',
            fix: 'Enter the bounds.',
          },
        ],
      }).reason,
    ).toBe('Georeferencing: Enter the bounds.')
    expect(runReadiness({ ...base, region: '   ' }).reason).toBe('Enter a region name.')
    expect(runReadiness({ ...base, capturedAtIso: null }).reason).toBe(
      'Enter when the image was captured.',
    )
    expect(runReadiness({ ...base, online: false }).reason).toBe(
      "You're offline. Reconnect to run detection.",
    )
    // Offline is reported last, so the form can be completed first.
    expect(runReadiness({ ...base, region: '', online: false }).reason).toBe('Enter a region name.')
  })

  it('does not block on warnings or pending checks', () => {
    const checks: QualityCheck[] = [
      { ...pass, status: 'warning' },
      { ...pass, id: 'cloud', status: 'pending' },
    ]
    expect(runReadiness({ ...base, checks }).ready).toBe(true)
  })
})
