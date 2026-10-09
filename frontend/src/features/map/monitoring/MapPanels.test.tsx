import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from '@/features/observations/api/mockApi'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Observation } from '@/features/observations/types'
import { analyzeObservation } from '@/lib/analysis'
import { DENSITY_LEVELS } from '@/lib/density'
import { DEFAULT_FILTERS } from '@/lib/filters'
import { mapStatusText } from '@/lib/map/status'
import { LegendLine } from '../LegendLine'
import { InspectNextLedger } from './InspectNextLedger'
import { MapToolbar } from './MapToolbar'

function hero(): Observation {
  const observation = getSampleObservation(SAMPLE_IDS.ennore)
  if (!observation) throw new Error('Hero sample missing')
  return observation
}

function wrap(ui: React.ReactNode) {
  return render(
    <AppProviders api={createMockApi({ latencyMs: [0, 0], pollLatencyMs: [0, 0] })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AppProviders>,
  )
}

describe('InspectNextLedger', () => {
  const observation = hero()
  const { hotspots } = analyzeObservation(observation)

  it('lists every hotspot as a row: rank, level, area and confidence, rank 1 emphasised', () => {
    wrap(
      <InspectNextLedger
        hotspots={hotspots}
        selectedId={null}
        onHighlight={vi.fn()}
        onSelect={vi.fn()}
        emptyText="Nothing"
      />,
    )
    const table = screen.getByRole('table', { name: 'Hotspots ranked by priority' })
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers).toEqual(['#', 'Level', 'Area', 'Conf.'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(hotspots.length)
    const first = rows[0] as HTMLElement
    const cells = within(first)
      .getAllByRole('cell')
      .map((c) => c.textContent)
    expect(cells[0]).toBe('1')
    expect(cells[1]).toBe(hotspots[0] ? DENSITY_LEVELS[hotspots[0].level].label : '')
    expect(cells[3]).toMatch(/^\d+%$/)
    expect(first).toHaveAttribute('data-first', 'true')
    expect(rows[1]).not.toHaveAttribute('data-first')
    // No coordinates in the row: they are in the tooltip and the drawer.
    expect(first.textContent).not.toMatch(/°/)
  })

  it('selects a row and highlights it on hover', async () => {
    const onSelect = vi.fn()
    const onHighlight = vi.fn()
    const user = userEvent.setup()
    wrap(
      <InspectNextLedger
        hotspots={hotspots}
        selectedId={hotspots[1]?.id ?? null}
        onHighlight={onHighlight}
        onSelect={onSelect}
        emptyText="Nothing"
      />,
    )
    const second = screen.getByRole('row', { name: /^Hotspot 2,/ })
    expect(second).toHaveAttribute('aria-current', 'true')
    await user.hover(screen.getByRole('row', { name: /^Hotspot 3,/ }))
    expect(onHighlight).toHaveBeenLastCalledWith(hotspots[2]?.id)
    await user.click(screen.getByRole('row', { name: /^Hotspot 1,/ }))
    expect(onSelect).toHaveBeenCalledWith(hotspots[0]?.id)
  })

  it('says why the list is empty', () => {
    wrap(
      <InspectNextLedger
        hotspots={[]}
        selectedId={null}
        onHighlight={vi.fn()}
        onSelect={vi.fn()}
        emptyText="No debris detected, so there is nothing to inspect."
      />,
    )
    expect(
      screen.getByText('No debris detected, so there is nothing to inspect.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('LegendLine', () => {
  function Controlled() {
    const [open, setOpen] = useState(false)
    return (
      <LegendLine cellSizeM={250} approximateFootprint={false} open={open} onOpenChange={setOpen} />
    )
  }

  it('is one line of the four levels, its details closed by default', () => {
    wrap(<Controlled />)
    const legend = screen.getByRole('region', { name: 'Map legend' })
    for (const level of ['Low', 'Moderate', 'High', 'Critical'])
      expect(within(legend).getByText(level)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Legend details' })).toBeNull()
  })

  it('opens a popover with the meanings, the outlines and the grid cell size', async () => {
    const user = userEvent.setup()
    wrap(<Controlled />)
    await user.click(screen.getByRole('button', { name: 'Legend details' }))
    const details = screen.getByRole('dialog', { name: 'Legend details' })
    expect(within(details).getByText('Priority hotspot')).toBeInTheDocument()
    expect(within(details).getByText(/Lower confidence/)).toBeInTheDocument()
    expect(within(details).getByText('Source image footprint')).toBeInTheDocument()
    expect(within(details).getByText(/grid of 250 m cells/)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Legend details' })).toBeNull()
  })

  it('opens from outside too (the "l" shortcut)', () => {
    wrap(<LegendLine cellSizeM={250} approximateFootprint open onOpenChange={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Legend details' })).toBeInTheDocument()
    expect(screen.getByText('Approximate footprint')).toBeInTheDocument()
  })
})

describe('MapToolbar', () => {
  const observation = hero()
  const analysis = analyzeObservation(observation)

  /** A 1440px screen: every min-width query matches (jsdom reports none by default). */
  function desktop() {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: /min-width/.test(query),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    )
  }
  afterEach(() => vi.restoreAllMocks())

  function renderToolbar(status: string) {
    wrap(
      <MapToolbar
        observations={[{ ...observation, detectionCount: observation.detections.length }]}
        observation={observation}
        onObservationChange={vi.fn()}
        filters={DEFAULT_FILTERS}
        baseline={DEFAULT_FILTERS}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
        status={status}
        matches
        exportSource={{ observation, detections: observation.detections, analysis, filters: null }}
        panel={null}
      />,
    )
  }

  it('states the count of detections and hotspots, politely announced', () => {
    desktop()
    const status = mapStatusText({
      shown: observation.detections.length,
      total: observation.detections.length,
      hotspots: analysis.hotspots.length,
      filtered: false,
    })
    renderToolbar(status)
    const toolbar = screen.getByRole('status')
    expect(toolbar).toHaveTextContent(
      `${observation.detections.length} detections · ${analysis.hotspots.length} hotspots`,
    )
    expect(toolbar).toHaveAttribute('aria-live', 'polite')
  })

  it('labels sample data and keeps the main row to two buttons besides its inputs', () => {
    desktop()
    renderToolbar('61 detections · 3 hotspots')
    expect(screen.getByText('Sample data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /More filters/ })).toBeInTheDocument()
    expect(screen.queryByText('Any date')).toBeNull()
    expect(screen.queryByText('All regions')).toBeNull()
    // Density is filtered here, by swatch: the level names are the buttons' names.
    for (const level of ['Low', 'Moderate', 'High', 'Critical'])
      expect(screen.getByRole('button', { name: level })).toHaveAttribute('aria-pressed', 'true')
  })

  it('collapses to the observation and one Filters button on phones', () => {
    renderToolbar('61 detections · 3 hotspots')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Minimum confidence' })).toBeNull()
  })
})
