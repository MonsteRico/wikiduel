import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WebSocketProvider } from '../websocket/WebSocketProvider'
import { ControllableWebSocket, sockets } from '../test/ControllableWebSocket'
import { LabPage } from './LabPage'
import { isPlayableArticleLabEnabled } from './labAvailability'
import type { PlayableArticle } from '@wikiduel/contracts'

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
    tableOfContents: [{ targetId: 'section-history', level: 2, label: 'History' }],
    blocks: [
      {
        type: 'heading',
        targetId: 'section-history',
        level: 2,
        children: [{ type: 'text', value: 'History' }],
      },
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
    ],
  },
}

const diagnostics = {
  requestedTitle: 'Alias title',
  wikipediaUrl: article.attribution.sourceUrl,
  canonicalIdentity: article.identity,
  revision: article.revision,
  durationMs: 23,
  cacheOutcome: 'miss' as const,
  emittedNodeCounts: {
    headings: 1,
    paragraphs: 1,
    lists: 0,
    listItems: 0,
    figures: 0,
    text: 2,
    strong: 0,
    emphasis: 0,
    navigation: 1,
  },
  omissions: {
    structure: { count: 1, reasons: ['table'], examples: [{ reason: 'table', subject: 'table' }] },
    links: { count: 1, reasons: ['external-link'], examples: [{ reason: 'external-link', subject: 'external' }] },
    images: { count: 0, reasons: [], examples: [] },
    imageAttribution: { count: 0, reasons: [], examples: [] },
  },
  retry: { attempts: 0 },
}

function renderLab() {
  render(
    <MemoryRouter>
      <WebSocketProvider>
        <LabPage />
      </WebSocketProvider>
    </MemoryRouter>,
  )
  const socket = sockets[0]
  if (!socket) throw new Error('Expected the shared WebSocket')
  socket.open()
  return socket
}

function lastRequest(socket: ControllableWebSocket) {
  const message = socket.sentMessages.at(-1)
  if (!message) throw new Error('Expected a preview request')
  return JSON.parse(message) as { type: string; requestId: string; requestedTitle: string }
}

describe('Playable Article Lab', () => {
  beforeEach(() => {
    sockets.length = 0
    vi.stubGlobal('WebSocket', ControllableWebSocket)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('is unavailable in production mode', () => {
    expect(isPlayableArticleLabEnabled('production')).toBe(false)
    expect(isPlayableArticleLabEnabled('development')).toBe(true)
  })

  it('submits a title, shows loading, renders the production article, and exposes diagnostics', async () => {
    const user = userEvent.setup()
    const socket = renderLab()

    await user.type(screen.getByLabelText('Wikipedia title'), 'Alias title')
    await user.click(screen.getByRole('button', { name: 'Load article' }))
    const request = lastRequest(socket)

    expect(request).toMatchObject({ type: 'preview-article', requestedTitle: 'Alias title' })
    expect(screen.getByRole('status')).toHaveTextContent('Loading Alias title')

    socket.receive({
      type: 'preview-article-result',
      requestId: request.requestId,
      requestedTitle: request.requestedTitle,
      ok: true,
      article,
      diagnostics,
    })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Canonical title', level: 1 })).toBeVisible())
    expect(screen.getByRole('article')).toHaveTextContent('Read the destination.')
    expect(screen.getByRole('region', { name: 'Table of contents' })).toHaveTextContent('History')
    expect(screen.getByRole('region', { name: 'Article diagnostics' })).toHaveTextContent('Alias title')
    expect(screen.getByRole('region', { name: 'Article diagnostics' })).toHaveTextContent('Cache: miss')
    expect(screen.getByRole('region', { name: 'Article diagnostics' })).toHaveTextContent('table')
    expect(screen.getByRole('link', { name: 'Open on Wikipedia' })).toHaveAttribute(
      'href',
      article.attribution.sourceUrl,
    )
    expect(screen.getByRole('region', { name: 'Article diagnostics' })).toHaveTextContent(
      'table — table',
    )
    expect(screen.getByRole('region', { name: 'Article diagnostics' }).closest('aside')).toHaveClass(
      'lg:sticky',
      'lg:top-6',
    )
  })

  it('jumps through the retained table of contents without sending a Navigation preview request', async () => {
    const user = userEvent.setup()
    const socket = renderLab()

    await user.type(screen.getByLabelText('Wikipedia title'), 'Alias title')
    await user.click(screen.getByRole('button', { name: 'Load article' }))
    const request = lastRequest(socket)
    socket.receive({
      type: 'preview-article-result',
      requestId: request.requestId,
      requestedTitle: request.requestedTitle,
      ok: true,
      article,
      diagnostics,
    })

    const historyHeading = await screen.findByRole('heading', { name: 'History', level: 2 })
    historyHeading.scrollIntoView = vi.fn()
    const sentMessageCount = socket.sentMessages.length

    await user.click(screen.getByRole('button', { name: 'History' }))

    expect(historyHeading).toHaveFocus()
    expect(historyHeading.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(socket.sentMessages).toHaveLength(sentMessageCount)
    expect(screen.getByRole('region', { name: 'Navigation history' })).toHaveTextContent(
      'No Navigation yet.',
    )
  })

  it('follows Navigation through a new preview request and ignores stale responses', async () => {
    const user = userEvent.setup()
    const socket = renderLab()

    await user.type(screen.getByLabelText('Wikipedia title'), 'First title')
    await user.click(screen.getByRole('button', { name: 'Load article' }))
    const firstRequest = lastRequest(socket)
    socket.receive({
      type: 'preview-article-result',
      requestId: firstRequest.requestId,
      requestedTitle: firstRequest.requestedTitle,
      ok: true,
      article,
      diagnostics,
    })

    await waitFor(() => expect(screen.getByRole('button', { name: 'destination' })).toBeVisible())
    await user.click(screen.getByRole('button', { name: 'destination' }))
    const navigationRequest = lastRequest(socket)
    expect(navigationRequest.requestedTitle).toBe('Destination title')
    expect(screen.getByRole('status')).toHaveTextContent('Loading Destination title')

    socket.receive({
      type: 'preview-article-result',
      requestId: firstRequest.requestId,
      requestedTitle: firstRequest.requestedTitle,
      ok: true,
      article: { ...article, identity: { pageId: 500, title: 'Stale title' } },
      diagnostics,
    })
    expect(screen.getByRole('heading', { name: 'Canonical title', level: 1 })).toBeVisible()

    socket.receive({
      type: 'preview-article-result',
      requestId: navigationRequest.requestId,
      requestedTitle: navigationRequest.requestedTitle,
      ok: false,
      failure: { code: 'upstream-rate-limited', retryAfterSeconds: 4 },
      diagnostics: {
        ...diagnostics,
        requestedTitle: 'Destination title',
        retry: { attempts: 0, retryAfterSeconds: 4 },
      },
    })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Canonical title', level: 1 })).toBeVisible())
    expect(screen.getByRole('alert')).toHaveTextContent('Retry available in 4 seconds')
    expect(screen.getByRole('region', { name: 'Navigation history' })).toHaveTextContent(
      'Canonical title → Destination title',
    )
  })

  it('shows terminal failures without discarding the last valid article', async () => {
    const user = userEvent.setup()
    const socket = renderLab()

    await user.type(screen.getByLabelText('Wikipedia title'), 'Known title')
    await user.click(screen.getByRole('button', { name: 'Load article' }))
    const firstRequest = lastRequest(socket)
    socket.receive({
      type: 'preview-article-result',
      requestId: firstRequest.requestId,
      requestedTitle: firstRequest.requestedTitle,
      ok: true,
      article,
      diagnostics,
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Canonical title', level: 1 })).toBeVisible())

    await user.clear(screen.getByLabelText('Wikipedia title'))
    await user.type(screen.getByLabelText('Wikipedia title'), 'Missing title')
    await user.click(screen.getByRole('button', { name: 'Load article' }))
    const failedRequest = lastRequest(socket)
    socket.receive({
      type: 'preview-article-result',
      requestId: failedRequest.requestId,
      requestedTitle: failedRequest.requestedTitle,
      ok: false,
      failure: { code: 'article-not-found' },
      diagnostics: { ...diagnostics, requestedTitle: 'Missing title' },
    })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No article was found'))
    expect(screen.getByRole('heading', { name: 'Canonical title', level: 1 })).toBeVisible()
    expect(screen.getByRole('alert')).not.toHaveTextContent('Retry available in')
  })
})
