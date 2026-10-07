import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from '@/features/observations/api/mockApi'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Observation } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { filterDetections } from '@/lib/filters'
import type { ExportSource } from './exportFiles'
import { ExportMenu } from './ExportMenu'

function sample(id: string): Observation {
  const observation = getSampleObservation(id)
  if (!observation) throw new Error(`missing ${id}`)
  return observation
}

const hero = sample(SAMPLE_IDS.ennore)

function renderMenu(source: ExportSource, detection = false) {
  const router = createMemoryRouter(
    [
      {
        path: '/map/:id',
        element: <ExportMenu source={source} detection={detection ? hero.detections[0] : null} />,
      },
      { path: '/observations/:id/report', element: <p>Report page</p> },
    ],
    { initialEntries: [`/map/${hero.id}?conf=70`] },
  )
  render(
    <AppProviders api={createMockApi()}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, user: userEvent.setup() }
}

const full: ExportSource = {
  observation: hero,
  detections: hero.detections,
  analysis: analyzeObservation(hero),
  filters: null,
}

afterEach(() => vi.restoreAllMocks())

describe('ExportMenu', () => {
  it('lists every export with its file type', async () => {
    const { user } = renderMenu(full)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    for (const name of [
      /Detections \(GeoJSON\)/,
      /Hotspots \(GeoJSON\)/,
      /Detections table \(CSV\)/,
      /Summary report \(PDF\)/,
      /Copy link to this view/,
    ]) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument()
    }
    expect(
      screen.getByText(
        `${hero.detections.length} detections with area, confidence and density level.`,
      ),
    ).toBeInTheDocument()
  })

  it('says how many filtered detections it will export', async () => {
    const detections = filterDetections(hero.detections, {
      minConfidence: 0.7,
      levels: ['high', 'critical'],
    })
    const { user } = renderMenu({
      observation: hero,
      detections,
      analysis: analyzeObservation({ ...hero, detections }),
      filters: 'Confidence 70% or more; density High, Critical',
    })
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(
      screen.getByText(
        `${detections.length} filtered detections with area, confidence and density level.`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`^${detections.length} filtered detections, one row each`)),
    ).toBeInTheDocument()
  })

  it('downloads with the documented file name and confirms with a toast', async () => {
    const createObjectURL = vi.fn(() => 'blob:test')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { user } = renderMenu(full)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('menuitem', { name: /Detections table \(CSV\)/ }))
    expect(click).toHaveBeenCalledOnce()
    expect(await screen.findByText('Export downloaded')).toBeInTheDocument()
    expect(
      screen.getByText('marine-debris_ennore-coast-bay-of-bengal_2026-10-03.csv'),
    ).toBeInTheDocument()
  })

  it('explains a failed export', async () => {
    Object.assign(URL, {
      createObjectURL: () => {
        throw new Error('blocked')
      },
    })
    const { user } = renderMenu(full)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('menuitem', { name: /Hotspots \(GeoJSON\)/ }))
    expect(await screen.findByText('The export could not be created')).toBeInTheDocument()
  })

  it('copies the current link, filters included', async () => {
    // user-event provides the clipboard; read back what was copied.
    const { user } = renderMenu(full)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('menuitem', { name: /Copy link/ }))
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(window.location.href)
  })

  it('opens the report ready to print', async () => {
    const { router, user } = renderMenu(full)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    await user.click(screen.getByRole('menuitem', { name: /Summary report \(PDF\)/ }))
    expect(router.state.location.pathname).toBe(`/observations/${hero.id}/report`)
    expect(router.state.location.search).toBe('?print=1')
  })

  it('offers the single detection in the drawer', async () => {
    const { user } = renderMenu(full, true)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(screen.getByRole('menuitem', { name: /This detection \(d001\)/ })).toBeInTheDocument()
  })
})
