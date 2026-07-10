import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArticleDocumentRenderer } from './ArticleDocumentRenderer'
import type { ArticleDocument } from './types'

afterEach(cleanup)

const revision = { id: 1776, timestamp: '2026-07-04T12:34:56Z' } as const
const attribution = {
  sourceUrl: 'https://en.wikipedia.org/wiki/Ada_Lovelace',
  historyUrl: 'https://en.wikipedia.org/w/index.php?title=Ada_Lovelace&action=history',
  licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  modificationNotice: 'Wiki Duel simplified and modified this article.',
} as const

describe('ArticleDocumentRenderer', () => {
  it('renders the canonical title and article prose with semantic headings and paragraphs', () => {
    const document: ArticleDocument = {
      title: 'Ada Lovelace',
      blocks: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Ada was an English mathematician.' }],
        },
        {
          type: 'heading',
          level: 2,
          children: [{ type: 'text', value: 'Early life' }],
        },
      ],
    }

    render(
      <ArticleDocumentRenderer
        document={document}
        revision={revision}
        attribution={attribution}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByRole('article')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' }),
    )
    expect(screen.getByText('Ada was an English mathematician.').tagName).toBe('P')
    expect(screen.getByRole('heading', { level: 2, name: 'Early life' })).toBeInTheDocument()
  })

  it('preserves nested list structure and semantic inline emphasis', () => {
    const document: ArticleDocument = {
      title: 'Computing',
      blocks: [
        {
          type: 'list',
          ordered: false,
          items: [
            {
              children: [
                {
                  type: 'strong',
                  children: [{ type: 'text', value: 'Analytical Engine' }],
                },
              ],
              blocks: [
                {
                  type: 'list',
                  ordered: true,
                  items: [
                    {
                      children: [
                        {
                          type: 'emphasis',
                          children: [{ type: 'text', value: 'First program' }],
                        },
                      ],
                      blocks: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <ArticleDocumentRenderer
        document={document}
        revision={revision}
        attribution={attribution}
        onNavigate={vi.fn()}
      />,
    )

    const lists = screen.getAllByRole('list')
    expect(lists.map((list) => list.tagName)).toEqual(['UL', 'OL'])
    expect(lists[0]).toContainElement(lists[1] ?? null)
    expect(screen.getByText('Analytical Engine').tagName).toBe('STRONG')
    expect(screen.getByText('First program').tagName).toBe('EM')
  })

  it('activates a prose Navigation Node with its canonical destination from the keyboard', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const document: ArticleDocument = {
      title: 'Ada Lovelace',
      blocks: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'She worked on the ' },
            {
              type: 'navigation',
              destination: { pageId: 12345, title: 'Analytical Engine' },
              children: [{ type: 'text', value: 'Analytical Engine' }],
            },
            { type: 'text', value: '.' },
          ],
        },
      ],
    }

    render(
      <ArticleDocumentRenderer
        document={document}
        revision={revision}
        attribution={attribution}
        onNavigate={onNavigate}
      />,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: 'Analytical Engine' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onNavigate).toHaveBeenCalledOnce()
    expect(onNavigate).toHaveBeenCalledWith({ pageId: 12345, title: 'Analytical Engine' })
  })

  it('renders a non-navigational figure with caption Navigation and complete image attribution', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const document: ArticleDocument = {
      title: 'Ada Lovelace',
      blocks: [
        {
          type: 'figure',
          sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada_Lovelace.jpg/640px-Ada_Lovelace.jpg',
          width: 640,
          height: 800,
          alt: 'Portrait of Ada Lovelace',
          caption: [
            { type: 'text', value: 'Portrait held by the ' },
            {
              type: 'navigation',
              destination: { pageId: 67890, title: 'Science Museum, London' },
              children: [{ type: 'text', value: 'Science Museum' }],
            },
          ],
          attribution: {
            descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Ada_Lovelace.jpg',
            historyUrl: 'https://commons.wikimedia.org/w/index.php?title=File:Ada_Lovelace.jpg&action=history',
            creator: 'Alfred Edward Chalon',
            credit: 'Science Museum Group',
            licenseName: 'Public domain',
            licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
          },
        },
      ],
    }

    render(
      <ArticleDocumentRenderer
        document={document}
        revision={revision}
        attribution={attribution}
        onNavigate={onNavigate}
      />,
    )

    const image = screen.getByRole('img', { name: 'Portrait of Ada Lovelace' })
    expect(image).toHaveAttribute('src', document.blocks[0]?.type === 'figure' ? document.blocks[0].sourceUrl : '')
    expect(image).toHaveAttribute('width', '640')
    expect(image).toHaveAttribute('height', '800')
    expect(image.closest('a')).toBeNull()

    const figure = image.closest('figure')
    expect(figure).not.toBeNull()
    const figureQueries = within(figure as HTMLElement)
    await user.click(figureQueries.getByRole('button', { name: 'Science Museum' }))
    expect(onNavigate).toHaveBeenCalledWith({ pageId: 67890, title: 'Science Museum, London' })
    expect(figureQueries.getByText('Alfred Edward Chalon')).toBeVisible()
    expect(figureQueries.getByText('Science Museum Group')).toBeVisible()
    expect(figureQueries.getByRole('link', { name: 'Image source' })).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/wiki/File:Ada_Lovelace.jpg',
    )
    expect(figureQueries.getByRole('link', { name: 'Image history' })).toBeVisible()
    expect(figureQueries.getByRole('link', { name: 'Public domain' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/publicdomain/mark/1.0/',
    )
  })

  it('renders revision and article attribution at the bottom of the article surface', () => {
    const document: ArticleDocument = {
      title: 'Ada Lovelace',
      blocks: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Article body.' }],
        },
      ],
    }

    render(
      <ArticleDocumentRenderer
        document={document}
        revision={revision}
        attribution={attribution}
        onNavigate={vi.fn()}
      />,
    )

    const article = screen.getByRole('article')
    const footer = article.querySelector('footer')
    expect(footer).toHaveAccessibleName('Article attribution')
    expect(article.lastElementChild).toBe(footer)
    const footerQueries = within(footer as HTMLElement)
    expect(footerQueries.getByText('Revision 1776')).toBeVisible()
    expect(footerQueries.getByText('2026-07-04T12:34:56Z').tagName).toBe('TIME')
    expect(footerQueries.getByRole('link', { name: 'Article source' })).toHaveAttribute(
      'href',
      'https://en.wikipedia.org/wiki/Ada_Lovelace',
    )
    expect(footerQueries.getByRole('link', { name: 'Page history' })).toBeVisible()
    expect(
      footerQueries.getByRole('link', {
        name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      }),
    ).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/')
    expect(footerQueries.getByText('Wiki Duel simplified and modified this article.')).toBeVisible()
  })

  it('renders upstream markup-shaped text without creating executable elements', () => {
    const document: ArticleDocument = {
      title: '<img src=x onerror=alert(1)>',
      blocks: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: '<script>alert("article")</script>' },
            {
              type: 'strong',
              children: [{ type: 'text', value: '</strong><iframe src="evil">' }],
            },
          ],
        },
      ],
    }

    const { container } = render(
      <ArticleDocumentRenderer
        document={document}
        revision={revision}
        attribution={{
          ...attribution,
          modificationNotice: '<img src=x onerror=alert("notice")>',
        }}
        onNavigate={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' }),
    ).toBeVisible()
    expect(screen.getByText('<script>alert("article")</script>')).toBeVisible()
    expect(screen.getByText('</strong><iframe src="evil">').tagName).toBe('STRONG')
    expect(screen.getByText('<img src=x onerror=alert("notice")>')).toBeVisible()
    expect(container.querySelector('script, iframe, img, [onerror]')).toBeNull()
  })
})
