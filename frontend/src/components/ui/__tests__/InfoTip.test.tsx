import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GLOSSARY } from '@/lib/glossary'
import { InfoTip } from '../InfoTip'

describe('InfoTip', () => {
  it('is a named, focusable button that explains the term', async () => {
    const user = userEvent.setup()
    render(<InfoTip label="Recall">{GLOSSARY.recall}</InfoTip>)
    const button = screen.getByRole('button', { name: 'About recall' })
    await user.tab()
    expect(button).toHaveFocus()
    expect(await screen.findByText(GLOSSARY.recall)).toBeInTheDocument()
  })
})
