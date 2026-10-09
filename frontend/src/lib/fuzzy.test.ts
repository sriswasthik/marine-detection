import { describe, expect, it } from 'vitest'
import { fuzzyScore, pushRecent, rankItems } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches characters in order, ignoring case, spaces and accents', () => {
    expect(fuzzyScore('anz', 'Analyze new imagery')).not.toBeNull()
    expect(fuzzyScore('ENNORE', 'Ennore coast')).not.toBeNull()
    expect(fuzzyScore('fit det', 'Fit to detections')).not.toBeNull()
    expect(fuzzyScore('sao', 'São Tomé')).not.toBeNull()
  })

  it('rejects text missing a character or holding them out of order', () => {
    expect(fuzzyScore('xyz', 'Analyze new imagery')).toBeNull()
    expect(fuzzyScore('pam', 'Map')).toBeNull()
  })

  it('scores word starts and runs above scattered letters', () => {
    const start = fuzzyScore('map', 'Map') ?? 0
    const scattered = fuzzyScore('map', 'Make a plan') ?? 0
    expect(start).toBeGreaterThan(scattered)
    const wordStart = fuzzyScore('nm', 'Open new map') ?? 0
    const inside = fuzzyScore('nm', 'Onomatopoeia') ?? 0
    expect(wordStart).toBeGreaterThan(inside)
  })

  it('matches everything with an empty query', () => {
    expect(fuzzyScore('', 'Anything')).toBe(0)
  })
})

describe('rankItems', () => {
  const items = [
    { id: 'page:/', label: 'Overview' },
    { id: 'page:/map', label: 'Map' },
    { id: 'obs:1', label: 'Ennore coast', keywords: ['obs-ennore-20261003', '3 Oct 2026'] },
    { id: 'obs:2', label: 'Mahim Bay', keywords: ['obs-mahim-20260929'] },
    { id: 'action:fit', label: 'Fit to detections' },
  ]

  it('lists recent items first, most recent first, when there is no query', () => {
    const ranked = rankItems(items, '', ['obs:2', 'action:fit'])
    expect(ranked.map((i) => i.id)).toEqual(['obs:2', 'action:fit', 'page:/', 'page:/map', 'obs:1'])
  })

  it('keeps only matches, best first, and searches keywords such as ids', () => {
    expect(rankItems(items, 'mahim').map((i) => i.id)).toEqual(['obs:2'])
    expect(rankItems(items, '20261003').map((i) => i.id)).toEqual(['obs:1'])
    expect(rankItems(items, 'ma')[0]?.id).toBe('page:/map')
  })

  it('breaks ties in favour of recent items', () => {
    const twins = [
      { id: 'a', label: 'Map' },
      { id: 'b', label: 'Map' },
    ]
    expect(rankItems(twins, 'map', ['b'])[0]?.id).toBe('b')
  })

  it('ignores recent ids that no longer exist', () => {
    expect(rankItems(items, '', ['gone'])).toHaveLength(items.length)
  })
})

describe('pushRecent', () => {
  it('puts the pick first, drops duplicates and keeps at most the limit', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })
})
