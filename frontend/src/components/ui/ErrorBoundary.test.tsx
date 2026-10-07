import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let shouldThrow = true
function Panel() {
  if (shouldThrow) throw new Error('Cannot read properties of undefined at Panel.tsx:3')
  return <p>Panel content</p>
}

function Page() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <button type="button" onClick={() => setCount(count + 1)}>
        Elsewhere {count}
      </button>
      <ErrorBoundary label="The chart">
        <Panel />
      </ErrorBoundary>
    </div>
  )
}

beforeEach(() => {
  shouldThrow = true
  // React logs caught render errors; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('contains a failing panel and keeps the rest of the page working', async () => {
    const user = userEvent.setup()
    render(<Page />)
    expect(
      screen.getByRole('heading', { name: 'The chart could not be shown' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/The rest of the page still works/)).toBeInTheDocument()
    // No raw message or stack trace.
    expect(document.body.textContent).not.toMatch(/Cannot read|Panel\.tsx/)

    await user.click(screen.getByRole('button', { name: 'Elsewhere 0' }))
    expect(screen.getByRole('button', { name: 'Elsewhere 1' })).toBeInTheDocument()
  })

  it('renders the panel again after Try again', async () => {
    const user = userEvent.setup()
    render(<Page />)
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('resets on its own when its reset keys change', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['a']}>
        <Panel />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    shouldThrow = false
    rerender(
      <ErrorBoundary resetKeys={['b']}>
        <Panel />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })
})
