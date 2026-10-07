import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/router'
import { ApiError } from '@/features/observations/api/errors'
import { createMockApi } from '@/features/observations/api/mockApi'
import type { ObservationsApi } from '@/features/observations/api/types'
import { getSampleObservation, SAMPLE_IDS } from '@/features/observations/mock/samples'
import type { Observation } from '@/features/observations/types'
import { DEFAULT_DETECTION_SORT, DETECTION_PAGE_SIZE, sortDetections } from '@/lib/detectionTable'
import { shortId } from '@/lib/format'

function sample(id: string): Observation {
  const observation = getSampleObservation(id)
  if (!observation) throw new Error(`missing sample ${id}`)
  return observation
}

const hero = sample(SAMPLE_IDS.ennore)
const clear = sample(SAMPLE_IDS.mannar)

/** The mock backend, with getObservation answering from `observations` (or failing for others). */
function apiWith(...observations: Observation[]): ObservationsApi {
  const base = createMockApi({
    latencyMs: [0, 0],
    pollLatencyMs: [0, 0],
    scenario: () => 'success',
  })
  return {
    ...base,
    getObservation: (id) => {
      const found = observations.find((o) => o.id === id)
      return found
        ? Promise.resolve({ data: found, issues: [] })
        : Promise.reject(new ApiError('Not found.', { status: 404, code: 'NOT_FOUND' }))
    },
  }
}

function renderDetail(path: string, api: ObservationsApi = apiWith(hero, clear)) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders api={api}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, user: userEvent.setup() }
}

const detailPath = (observation: Observation, search = '') =>
  `/observations/${observation.id}${search}`

async function title(name: string) {
  return screen.findByRole('heading', { level: 1, name }, { timeout: 5000 })
}

function detectionsTable() {
  return screen.getByRole('table', { name: /^Detections, sorted by/ })
}

function bodyRows(table: HTMLElement) {
  const [, body] = within(table).getAllByRole('rowgroup')
  if (!body) throw new Error('No table body')
  return within(body).getAllByRole('row')
}

afterEach(() => window.localStorage.clear())

describe('Observation detail page', { timeout: 20_000 }, () => {
  it('shows the header, evidence, metrics and placeholder model figures for the hero scene', async () => {
    renderDetail(detailPath(hero))
    await title(hero.region)

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(
      `Observations${hero.region}`,
    )
    expect(screen.getByRole('link', { name: /Open on map/ })).toHaveAttribute(
      'href',
      `/map/${hero.id}`,
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()

    expect(screen.getByRole('radio', { name: 'Segmentation' })).toBeChecked()
    expect(
      screen.getByText('Showing basemap imagery. Source preview not available for sample data.'),
    ).toBeInTheDocument()

    for (const label of [
      'Detected area',
      'Water area',
      'Coverage',
      'Average confidence',
      'Detected regions',
      'Hotspots',
    ]) {
      expect(screen.getByRole('button', { name: `About ${label.toLowerCase()}` })).toBeVisible()
    }

    const quality = screen.getByRole('heading', { name: 'Model quality' }).closest('section')
    if (!quality) throw new Error('No model quality card')
    expect(within(quality).getByText('Sample values')).toBeInTheDocument()
    expect(within(quality).getByText(/placeholder figures/)).toBeInTheDocument()
    expect(within(quality).getByText('81%')).toBeInTheDocument()
  })

  it('renders detections a page at a time and sorts them by any column', async () => {
    const { user } = renderDetail(detailPath(hero))
    await title(hero.region)
    const table = detectionsTable()
    expect(bodyRows(table)).toHaveLength(DETECTION_PAGE_SIZE)
    expect(
      screen.getByText(`Showing ${DETECTION_PAGE_SIZE} of ${hero.detections.length}`),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Show \d+ more$/ }))
    expect(bodyRows(table)).toHaveLength(Math.min(DETECTION_PAGE_SIZE * 2, hero.detections.length))

    const confidenceHeader = within(table).getByRole('columnheader', { name: /Confidence/ })
    expect(confidenceHeader).toHaveAttribute('aria-sort', 'none')
    await user.click(within(confidenceHeader).getByRole('button'))
    expect(confidenceHeader).toHaveAttribute('aria-sort', 'descending')
    const best = sortDetections(hero.detections, { key: 'confidence', direction: 'desc' })[0]
    expect(bodyRows(table)[0]).toHaveTextContent(shortId(best?.id ?? ''))

    await user.click(within(confidenceHeader).getByRole('button'))
    expect(confidenceHeader).toHaveAttribute('aria-sort', 'ascending')
  })

  it('opens focused on ?detection, even when its row is beyond the first page', async () => {
    const sorted = sortDetections(hero.detections, DEFAULT_DETECTION_SORT)
    const target = sorted[sorted.length - 1]
    if (!target) throw new Error('No detections')
    renderDetail(detailPath(hero, `?detection=${target.id}`))
    await title(hero.region)

    expect(screen.getByRole('radio', { name: 'Geographic result' })).toBeChecked()
    expect(screen.getByRole('status', { name: 'Selected detection' })).toHaveTextContent(
      shortId(target.id),
    )
    const row = bodyRows(detectionsTable()).find((r) => r.getAttribute('aria-selected') === 'true')
    expect(row).toHaveTextContent(shortId(target.id))
  })

  it('ignores an unknown ?detection and opens on the segmentation', async () => {
    renderDetail(detailPath(hero, '?detection=not-a-detection'))
    await title(hero.region)
    expect(screen.getByRole('radio', { name: 'Segmentation' })).toBeChecked()
    expect(screen.queryByRole('status', { name: 'Selected detection' })).not.toBeInTheDocument()
  })

  it('focuses a detection from the table and keeps it in the URL', async () => {
    const { router, user } = renderDetail(detailPath(hero))
    await title(hero.region)
    const first = sortDetections(hero.detections, DEFAULT_DETECTION_SORT)[0]
    if (!first) throw new Error('No detections')

    await user.click(screen.getByRole('button', { name: `Focus detection ${shortId(first.id)}` }))
    expect(screen.getByRole('radio', { name: 'Geographic result' })).toBeChecked()
    expect(router.state.location.search).toBe(`?detection=${first.id}`)
    expect(screen.getByRole('status', { name: 'Selected detection' })).toHaveTextContent(
      shortId(first.id),
    )

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(router.state.location.search).toBe('')
  })

  it('moves the compare divider with the keyboard', async () => {
    const { user } = renderDetail(detailPath(hero))
    await title(hero.region)
    await user.click(screen.getByRole('radio', { name: 'Compare' }))

    const divider = screen.getByRole('slider', { name: 'Compare divider' })
    expect(divider).toHaveAttribute('aria-valuenow', '50')
    divider.focus()
    await user.keyboard('{ArrowRight}')
    expect(divider).toHaveAttribute('aria-valuenow', '52')
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(divider).toHaveAttribute('aria-valuenow', '42')
    await user.keyboard('{End}')
    expect(divider).toHaveAttribute('aria-valuenow', '100')
    expect(divider).toHaveAttribute('aria-valuetext', '100% original, 0% with segmentation')
  })

  it('switches the viewer from the traceability strip', async () => {
    const { user } = renderDetail(detailPath(hero))
    await title(hero.region)
    const strip = screen.getByRole('navigation', { name: 'Trace from image to location' })
    await user.click(within(strip).getByRole('button', { name: /Source image/ }))
    expect(screen.getByRole('radio', { name: 'Original' })).toBeChecked()
    await user.click(within(strip).getByRole('button', { name: /Geographic result/ }))
    expect(screen.getByRole('radio', { name: 'Geographic result' })).toBeChecked()
  })

  it('designs the no-debris result: real zeros, no NaN, a calm sentence instead of the table', async () => {
    renderDetail(detailPath(clear))
    await title(clear.region)

    expect(screen.getByRole('heading', { name: 'No debris detected' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'The model checked the whole image and outlined no debris, so there is nothing to list.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: /^Detections/ })).not.toBeInTheDocument()

    const metric = (label: string) =>
      screen.getByText(label).closest('div.rounded-card')?.textContent ?? ''
    expect(metric('Detected area')).toContain('0 m²')
    expect(metric('Coverage')).toContain('0%')
    expect(metric('Detected regions')).toContain('0')
    expect(metric('Average confidence')).toContain('No detections to average')
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/)
  })

  it('renders no model quality card when the observation has no metrics', async () => {
    const withoutMetrics: Observation = { ...hero, modelMetrics: undefined }
    renderDetail(detailPath(hero), apiWith(withoutMetrics))
    await title(hero.region)
    expect(screen.queryByRole('heading', { name: 'Model quality' })).not.toBeInTheDocument()
  })

  it('shows real metrics without the sample label', async () => {
    const real: Observation = {
      ...hero,
      modelMetrics: {
        precision: 0.9,
        recall: 0.8,
        f1: 0.85,
        accuracy: 0.95,
        benchmark: 'Project test split',
        isPlaceholder: false,
      },
    }
    renderDetail(detailPath(hero), apiWith(real))
    await title(hero.region)
    const quality = screen.getByRole('heading', { name: 'Model quality' }).closest('section')
    if (!quality) throw new Error('No model quality card')
    expect(within(quality).queryByText('Sample values')).not.toBeInTheDocument()
    expect(within(quality).getByText('Project test split')).toBeInTheDocument()
    expect(within(quality).getByText('90%')).toBeInTheDocument()
  })

  it('says so when the observation does not exist', async () => {
    renderDetail('/observations/obs-missing')
    await title('Observation not found')
    expect(screen.getByRole('link', { name: 'View observations' })).toHaveAttribute(
      'href',
      '/observations',
    )
  })

  it('explains a failed observation instead of showing empty results', async () => {
    const failed: Observation = { ...hero, status: 'failed', detections: [] }
    renderDetail(detailPath(hero), apiWith(failed))
    await title(hero.region)
    expect(screen.getByRole('heading', { name: 'Processing failed' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Measurements' })).not.toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    const api = apiWith()
    let calls = 0
    api.getObservation = () => {
      calls += 1
      return calls === 1
        ? Promise.reject(new ApiError('Bad input.', { status: 400, code: 'INVALID_RESPONSE' }))
        : Promise.resolve({ data: hero, issues: [] })
    }
    const { user } = renderDetail(detailPath(hero), api)
    await title('The service sent data this app cannot read')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await title(hero.region)
  })
})
