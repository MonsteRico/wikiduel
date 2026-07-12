import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Infobox } from './Infobox'
import type { ArticleInfobox } from './types'

afterEach(cleanup)

const block: ArticleInfobox = {
  type: 'infobox',
  title: [{ type: 'text', value: 'Ada Lovelace' }],
  sections: [
    {
      label: [{ type: 'text', value: 'Personal details' }],
      items: [
        {
          label: [{ type: 'text', value: 'Born' }],
          blocks: [
            {
              type: 'line',
              children: [
                { type: 'text', value: 'London, ' },
                {
                  type: 'navigation',
                  destination: { pageId: 2, title: 'London' },
                  children: [{ type: 'text', value: 'England' }],
                },
              ],
            },
            {
              type: 'figure',
              sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ada.jpg',
              width: 320,
              height: 400,
              alt: 'Portrait of Ada Lovelace',
              caption: [{ type: 'text', value: 'Portrait' }],
              attribution: {
                descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Ada.jpg',
                historyUrl: 'https://commons.wikimedia.org/w/index.php?title=File:Ada.jpg&action=history',
                licenseName: 'Public domain',
                licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
              },
            },
          ],
        },
        {
          blocks: [
            { type: 'media-placeholder', kind: 'audio' },
            { type: 'media-placeholder', kind: 'video' },
          ],
        },
      ],
    },
  ],
}

describe('Infobox', () => {
  it('renders semantic facts, attributed media, and noninteractive media placeholders', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(<Infobox block={block} onNavigate={onNavigate} />)

    const infobox = screen.getByRole('complementary', { name: 'Infobox' })
    expect(infobox).toContainElement(screen.getByText('Ada Lovelace'))
    expect(within(infobox).getByText('Personal details')).toBeVisible()
    expect(within(infobox).getByText('Born').tagName).toBe('DT')
    expect(within(infobox).getByRole('img', { name: 'Portrait of Ada Lovelace' })).toBeVisible()
    expect(within(infobox).getByText('Audio element omitted.')).toBeVisible()
    expect(within(infobox).getByText('Video element omitted.')).toBeVisible()
    expect(infobox.querySelector('audio, video, source')).toBeNull()
    expect(within(infobox).queryByRole('heading')).toBeNull()

    await user.click(within(infobox).getByRole('button', { name: 'England' }))
    expect(onNavigate).toHaveBeenCalledWith({ pageId: 2, title: 'London' })
    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it('starts expanded and collapses locally without requesting Navigation', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(<Infobox block={block} onNavigate={onNavigate} />)

    const infobox = screen.getByRole('complementary', { name: 'Infobox' })
    const toggle = within(infobox).getByRole('button', { name: 'Collapse infobox' })
    const content = within(infobox).getByText('Personal details').closest('section')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(content).toBeVisible()

    await user.click(toggle)

    expect(within(infobox).getByRole('button', { name: 'Expand infobox' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(content).not.toBeVisible()
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
