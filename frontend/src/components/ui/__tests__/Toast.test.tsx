import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST_DEFAULT_DURATION_MS, useToast, type ToastOptions } from '../toast/toastContext'
import { ToastProvider } from '../toast/ToastProvider'

function Trigger({ options }: { options: ToastOptions }) {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast.show(options)}>
      Notify
    </button>
  )
}

function renderWithToast(options: ToastOptions) {
  return render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  )
}

const click = (name: string) =>
  act(() => {
    screen.getByRole('button', { name }).click()
  })

/**
 * The toast leaves the DOM once its exit animation ends, which framer-motion schedules on
 * real animation frames. Switch back to real timers and wait for it.
 */
async function expectRemoved(text: string) {
  vi.useRealTimers()
  await waitFor(() => expect(screen.queryByText(text)).toBeNull())
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('announces toasts in a polite live region', () => {
    renderWithToast({ title: 'Report saved', description: 'Saved to your downloads.' })
    const region = screen.getByRole('region', { name: 'Notifications' })
    const live = region.querySelector('[aria-live]')
    expect(live).toHaveAttribute('aria-live', 'polite')
    click('Notify')
    expect(live).toHaveTextContent('Report saved')
    expect(live).toHaveTextContent('Saved to your downloads.')
  })

  it('dismisses itself after the default duration', async () => {
    renderWithToast({ title: 'Analysis started' })
    click('Notify')
    expect(screen.getByText('Analysis started')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS - 100)
    })
    expect(screen.getByText('Analysis started')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    await expectRemoved('Analysis started')
  })

  it('stays until dismissed when duration is 0', async () => {
    renderWithToast({ title: 'Upload failed', tone: 'danger', duration: 0 })
    click('Notify')
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Upload failed')).toBeInTheDocument()
    click('Dismiss notification')
    await expectRemoved('Upload failed')
  })

  it('runs the action and closes', async () => {
    const onClick = vi.fn()
    renderWithToast({ title: 'Upload failed', duration: 0, action: { label: 'Retry', onClick } })
    click('Notify')
    click('Retry')
    expect(onClick).toHaveBeenCalledOnce()
    await expectRemoved('Upload failed')
  })

  it('throws a clear error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger options={{ title: 'Orphan' }} />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})
