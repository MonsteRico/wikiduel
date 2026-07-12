import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PlayableArticleArea } from './PlayableArticleArea'
import type { PlayableArticle } from './types'

const article: PlayableArticle = {
  identity: { pageId: 42, title: 'Canonical title' },
  revision: { id: 1776, timestamp: '2026-07-04T12:34:56Z' },
  attribution: {
    sourceUrl: 'https://en.wikipedia.org/wiki/Canonical_title?oldid=1776',
    historyUrl: 'https://en.wikipedia.org/w/index.php?title=Canonical_title&action=history',
    licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    modificationNotice: 'Wiki Duel simplified and modified this Wikipedia article.',
  },
  document: {
    title: 'Canonical title',
    blocks: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Read the ' },
          {
            type: 'navigation',
            destination: { pageId: 99, title: 'Destination title' },
            children: [{ type: 'text', value: 'destination' }],
          },
          { type: 'text', value: '.' },
        ],
      },
      {
        type: 'figure',
        sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg',
        width: 320,
        height: 240,
        alt: 'Example figure',
        caption: [{ type: 'text', value: 'Example caption.' }],
        attribution: {
          descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
          historyUrl: 'https://commons.wikimedia.org/w/index.php?title=File:Example.jpg&action=history',
          licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
          creator: 'Example creator',
          credit: 'Example credit',
        },
      },
    ],
  },
}

describe('PlayableArticleArea', () => {
  it('wraps the semantic renderer with reusable article chrome and preserves Navigation callbacks', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(<PlayableArticleArea article={article} onNavigate={onNavigate} />)

    expect(screen.getByRole('region', { name: 'Playable Article area' })).toBeVisible()
    expect(screen.getByText('Current article')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Canonical title', level: 2 })).toBeVisible()
    expect(screen.getByLabelText('Wikipedia page ID 42')).toHaveTextContent('#42')
    expect(screen.getByRole('article')).toHaveTextContent('Read the destination.')
    expect(screen.getByRole('img', { name: 'Example figure' })).toBeVisible()
    expect(screen.getByLabelText('Article attribution')).toHaveTextContent(
      'Wiki Duel simplified and modified this Wikipedia article.',
    )

    await user.click(screen.getByRole('button', { name: 'destination' }))

    expect(onNavigate).toHaveBeenCalledWith({ pageId: 99, title: 'Destination title' })
  })
})
