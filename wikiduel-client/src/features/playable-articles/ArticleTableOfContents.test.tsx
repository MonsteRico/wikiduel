import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArticleTableOfContents } from './ArticleTableOfContents'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('ArticleTableOfContents', () => {
  it('renders the server-owned outline with explicit heading levels', () => {
    render(
      <ArticleTableOfContents
        entries={[
          { targetId: 'section-history', level: 2, label: 'History' },
          { targetId: 'section-early-life', level: 3, label: 'Early life' },
        ]}
      />,
    )

    expect(screen.getByRole('region', { name: 'Table of contents' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute(
      'aria-controls',
      'section-history',
    )
    expect(screen.getByRole('button', { name: 'Early life' }).closest('li')).toHaveAttribute(
      'aria-level',
      '3',
    )
  })

  it('focuses and scrolls to a same-article heading without exposing a navigation callback', async () => {
    const user = userEvent.setup()
    const heading = document.createElement('h2')
    heading.id = 'section-history'
    heading.tabIndex = -1
    heading.scrollIntoView = vi.fn()
    document.body.append(heading)

    render(
      <ArticleTableOfContents
        entries={[{ targetId: 'section-history', level: 2, label: 'History' }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'History' }))

    expect(heading).toHaveFocus()
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })
})
