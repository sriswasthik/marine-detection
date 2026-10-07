import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createMockApi } from '@/features/observations/api/mockApi'
import { APP_ERROR_CODES, ERROR_COPY } from '@/lib/errors/errorCopy'
import { StatesPage } from './StatesPage'

afterEach(() => vi.restoreAllMocks())

describe('/design/states', () => {
  it('renders every error code and every shared state group', () => {
    // The boundary demo throws on purpose; React logs it.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <AppProviders api={createMockApi()}>
        <MemoryRouter>
          <StatesPage />
        </MemoryRouter>
      </AppProviders>,
    )
    for (const code of APP_ERROR_CODES) {
      expect(screen.getAllByText(ERROR_COPY[code].title).length).toBeGreaterThan(0)
    }
    for (const section of [
      'Empty and status states',
      'Banner',
      'Skeletons',
      'Analysis run: uploading, processing, success, failures',
      'Error boundary and toasts',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument()
    }
    expect(
      screen.getByRole('heading', { name: 'The demo panel could not be shown' }),
    ).toBeInTheDocument()
  })
})
