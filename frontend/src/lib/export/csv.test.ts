import { describe, expect, it } from 'vitest'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Detection, Observation } from '@/features/observations/types'
import { csvField, DETECTION_CSV_COLUMNS, detectionsCsv, round, toCsv, UTF8_BOM } from './csv'

function sample(id: string): Observation {
  const observation = getSampleObservation(id)
  if (!observation) throw new Error(`missing ${id}`)
  return observation
}

const hero = sample(SAMPLE_IDS.ennore)

/** A minimal RFC 4180 reader, to check that what we write parses back. */
function parseCsv(text: string): string[][] {
  const body = text.startsWith(UTF8_BOM) ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quoted) {
      if (char === '"' && body[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\r' && body[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else field += char
  }
  return rows
}

describe('csvField', () => {
  it('leaves plain text and numbers alone', () => {
    expect(csvField('Ennore')).toBe('Ennore')
    expect(csvField(12.5)).toBe('12.5')
    expect(csvField(-80.34)).toBe('-80.34')
    expect(csvField(null)).toBe('')
    expect(csvField(Number.NaN)).toBe('')
  })

  it('quotes commas, quotes and line breaks, doubling quotes', () => {
    expect(csvField('Ennore coast, Bay of Bengal')).toBe('"Ennore coast, Bay of Bengal"')
    expect(csvField('The "north" jetty')).toBe('"The ""north"" jetty"')
    expect(csvField('Line one\nline two')).toBe('"Line one\nline two"')
    expect(csvField('Carriage\r\nreturn')).toBe('"Carriage\r\nreturn"')
  })

  it('keeps text that looks like a formula as text', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvField('+44 harbour')).toBe("'+44 harbour")
    expect(csvField('@risk')).toBe("'@risk")
  })
})

describe('toCsv', () => {
  it('starts with a BOM and ends every line with CRLF', () => {
    const text = toCsv(['a', 'b'], [[1, 'x']])
    expect(text.startsWith(UTF8_BOM)).toBe(true)
    expect(text).toBe(`${UTF8_BOM}a,b\r\n1,x\r\n`)
  })
})

describe('detectionsCsv', () => {
  it('has the documented columns and one row per detection', () => {
    const rows = parseCsv(detectionsCsv(hero, hero.detections))
    expect(rows[0]).toEqual([...DETECTION_CSV_COLUMNS])
    expect(rows).toHaveLength(hero.detections.length + 1)
  })

  it('round-trips awkward region names with commas, quotes and line breaks', () => {
    const awkward = { ...hero, region: 'Pier 4, "Old" harbour\nnorth side' }
    const rows = parseCsv(detectionsCsv(awkward, hero.detections.slice(0, 2)))
    expect(rows[1]?.[2]).toBe('Pier 4, "Old" harbour\nnorth side')
    expect(rows[1]).toHaveLength(DETECTION_CSV_COLUMNS.length)
  })

  it('writes sensible precision: 6 decimals for coordinates, 3 for confidence', () => {
    const detection = hero.detections[0] as Detection
    const tricky: Detection = {
      ...detection,
      centroid: { lat: 13.123456789, lng: 80.987654321 },
      areaM2: 1234.5678,
      confidence: 0.87654,
    }
    const [, row] = parseCsv(detectionsCsv(hero, [tricky]))
    const value = (column: string) => row?.[DETECTION_CSV_COLUMNS.indexOf(column as never)]
    expect(value('lat')).toBe('13.123457')
    expect(value('lng')).toBe('80.987654')
    expect(value('area_m2')).toBe('1234.57')
    expect(value('area_ha')).toBe('0.123457')
    expect(value('confidence')).toBe('0.877')
    expect(value('density_level')).toBe(detection.densityLevel)
  })

  it('writes just the header for a no-debris observation', () => {
    const rows = parseCsv(detectionsCsv(hero, []))
    expect(rows).toEqual([[...DETECTION_CSV_COLUMNS]])
  })

  it('rounds without float noise', () => {
    expect(round(0.1 + 0.2, 3)).toBe(0.3)
    expect(round(1.005, 2)).toBe(1.01)
  })
})
