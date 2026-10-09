import { describe, expect, it } from 'vitest'
import tokensCss from '@/styles/tokens.css?raw'
import {
  DRAWER_WIDTH_PX,
  NOTHING_OCCLUDED,
  occludedEdges,
  SHEET_PEEK_FRACTION,
  visiblePadding,
} from './occlusion'

describe('occludedEdges', () => {
  it('hides nothing while the drawer is closed', () => {
    expect(occludedEdges({ drawerOpen: false, isDesktop: true, viewportHeight: 900 })).toEqual(
      NOTHING_OCCLUDED,
    )
    expect(occludedEdges({ drawerOpen: false, isDesktop: false, viewportHeight: 844 })).toEqual(
      NOTHING_OCCLUDED,
    )
  })

  it('hides the drawer width on the right on desktop', () => {
    expect(occludedEdges({ drawerOpen: true, isDesktop: true, viewportHeight: 900 })).toEqual({
      right: DRAWER_WIDTH_PX,
      bottom: 0,
    })
  })

  it('hides the half-height sheet at the bottom on mobile', () => {
    expect(occludedEdges({ drawerOpen: true, isDesktop: false, viewportHeight: 844 })).toEqual({
      right: 0,
      bottom: Math.round(844 * SHEET_PEEK_FRACTION),
    })
  })

  it('matches the drawer width token', () => {
    expect(tokensCss).toContain(`--spacing-drawer: ${DRAWER_WIDTH_PX}px;`)
  })
})

describe('visiblePadding', () => {
  it('adds the hidden edges to the bottom-right padding only', () => {
    expect(visiblePadding(48, { right: 380, bottom: 0 })).toEqual({
      paddingTopLeft: [48, 48],
      paddingBottomRight: [428, 48],
    })
    expect(visiblePadding(48, { right: 0, bottom: 422 })).toEqual({
      paddingTopLeft: [48, 48],
      paddingBottomRight: [48, 470],
    })
  })
})
