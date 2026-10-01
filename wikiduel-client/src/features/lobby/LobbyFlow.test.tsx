import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../../App'
import { ControllableWebSocket, sockets } from '../../test/ControllableWebSocket'
import type { Lobby, PreparingDuelProjection, PlayableArticle } from '@wikiduel/contracts'

const roundArticle: PlayableArticle = {
  identity: { pageId: 1001, title: 'Fixture Start One' },
  revision: { id: 1, timestamp: '2026-10-01T00:00:00Z' },
  attribution: {
    sourceUrl: 'https://en.wikipedia.org/wiki/Fixture_Start_One',
    historyUrl: 'https://en.wikipedia.org/w/index.php?title=Fixture_Start_One&action=history',
    licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    modificationNotice: 'Adapted for Wiki Duel',
  },
  document: { title: 'Fixture Start One', tableOfContents: [], blocks: [{
    type: 'paragraph', children: [
      { type: 'text', value: 'Secret article content. ' },
      { type: 'navigation', destination: { pageId: 1002, title: 'Fixture Target One' },
        children: [{ type: 'text', value: 'Follow this link' }] },
    ],
  }] },
}

function preparedDuel(clientId: string): PreparingDuelProjection {
  return {
    id: 'duel-1', phase: 'preparing', serverNow: 100_000,
    round: { id: 'round-1', number: 1, article: roundArticle, prompt: {
      id: 'prompt-1', start: roundArticle.identity, target: { pageId: 1002, title: 'Fixture Target One' },
    } },
    self: { id: clientId, name: 'Host', role: 'host', hp: 100, path: [roundArticle.identity], clicks: 0 },
    opponent: { id: 'opponent', name: 'Opponent', role: 'opponent', hp: 100, clicks: 0, connected: true },
  }
}
function hostLobby(clientId: string): Lobby {
  return {
    code: '7G8KZ',
    members: [{ id: clientId, name: 'host', role: 'host', connected: true, ready: false }],
  }
}

function renderApp(initialPath = '/') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )

  const socket = sockets.at(-1)
  if (!socket) throw new Error('Expected the WebSocket provider to open a connection')
  return socket
}

function sentMessages(socket: ControllableWebSocket) {
  return socket.sentMessages.map((message) => JSON.parse(message) as Record<string, unknown>)
}

function sentClientId(socket: ControllableWebSocket) {
  const clientId = sentMessages(socket).find((message) => 'clientId' in message)?.clientId
  if (typeof clientId !== 'string') throw new Error('Expected a command with a clientId')
  return clientId
}

beforeEach(() => {
  sockets.length = 0
  vi.stubGlobal('WebSocket', ControllableWebSocket)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Lobby client', () => {
  it('locks Navigation until its result and displays only authoritative route and opponent status', () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const prepared = preparedDuel(sentClientId(socket))
    const duel = { ...prepared, phase: 'active' as const, startsAt: 99_000,
      round: { ...prepared.round, article: roundArticle } }
    act(() => socket.receive({ type: 'duel-state', duel }))
    const link = screen.getByRole('button', { name: 'Follow this link' })
    act(() => { link.click(); link.click() })
    expect(link).toBeDisabled()
    const command = sentMessages(socket).at(-1)!
    expect(command).toMatchObject({ type: 'navigate', source: roundArticle.identity, expectedClicks: 0 })
    expect(sentMessages(socket).filter((message) => message.type === 'navigate')).toHaveLength(1)
    act(() => socket.receive({ type: 'duel-state', duel: { ...duel, opponent: { ...duel.opponent, clicks: 3 } } }))
    expect(link).toBeDisabled()
    expect(screen.getByLabelText('Opponent status')).toHaveTextContent('3 clicks')
    expect(screen.getByLabelText('Opponent status')).toHaveTextContent('Connected')
    act(() => socket.receive({ type: 'navigation-result', duelId: duel.id, roundId: duel.round.id,
      requestId: 'unrelated', accepted: false }))
    expect(link).toBeDisabled()
    act(() => socket.receive({ type: 'navigation-result', duelId: duel.id, roundId: duel.round.id,
      requestId: String(command.requestId), accepted: false }))
    expect(link).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Navigation failed')
    const target = prepared.round.prompt.target
    act(() => link.click())
    act(() => socket.receive({ type: 'duel-state', duel: { ...duel,
      self: { ...duel.self, clicks: 1, path: [roundArticle.identity, target] },
      round: { ...duel.round, article: { ...roundArticle, identity: target } } } }))
    const path = screen.getByRole('list', { name: 'Your path' })
    expect(within(path).getAllByRole('listitem')).toHaveLength(2)
    expect(within(path).queryByRole('button')).not.toBeInTheDocument()
    expect(within(path).queryByRole('link')).not.toBeInTheDocument()
  })
  it.each(['post-round', 'completed'] as const)('stops active play when the server reports %s', (phase) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const duel = preparedDuel(sentClientId(socket))
    act(() => socket.receive({ type: 'duel-state', duel: {
      ...duel, phase: 'active', startsAt: 99_000, round: { ...duel.round, article: roundArticle },
    } }))
    expect(screen.getByText(/Secret article content/)).toBeVisible()
    act(() => socket.receive({ type: 'duel-state', duel: {
      ...duel, phase, startsAt: 99_000, round: { ...duel.round, article: roundArticle },
      outcome: {
        roundId: 'round-1', roundNumber: 1, endReason: 'target-arrival', winnerId: duel.self.id,
        startsAt: 99_000, endedAt: 100_000, final: phase === 'completed',
        players: [
          { id: duel.self.id, path: [roundArticle.identity], clicks: 1, activeElapsedMs: 1000, hp: 100 },
          { id: 'opponent', path: [roundArticle.identity], clicks: 0, activeElapsedMs: 1000, hp: phase === 'completed' ? 0 : 78 },
        ],
        damage: { winnerClicks: 1, loserClicks: 0, baseDamage: 25, clickDifferential: -1,
          clickMultiplier: 3, multiplierContribution: -3, unclampedDamage: 22,
          minimumDamage: 15, maximumDamage: 60, finalDamage: 22 },
      },
    } }))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('button', { name: 'Follow this link' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Elapsed time')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Round ended' })).toBeVisible()
  })

  it('acknowledges covered rendering once and uses server time for countdown and stopwatch', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const duel = preparedDuel(sentClientId(socket))
    act(() => socket.receive({ type: 'duel-state', duel }))
    expect(screen.getByText(/Secret article content/)).not.toBeVisible()
    expect(screen.queryByRole('button', { name: 'Follow this link' })).not.toBeInTheDocument()
    expect(sentMessages(socket).filter((message) => String(message.type).startsWith('round-'))).toEqual([
      { type: 'round-received', duelId: 'duel-1', roundId: 'round-1' },
      { type: 'round-rendered', duelId: 'duel-1', roundId: 'round-1' },
    ])
    act(() => socket.receive({ type: 'duel-state', duel }))
    expect(sentMessages(socket).filter((message) => message.type === 'round-rendered')).toHaveLength(1)
    act(() => socket.receive({ type: 'duel-state', duel: {
      ...duel, phase: 'countdown', startsAt: 103_000,
      round: { ...duel.round, article: roundArticle },
    } }))
    expect(screen.getByLabelText('Round countdown')).toHaveTextContent('3')
    expect(screen.getByText('Target: Fixture Target One')).toBeVisible()
    act(() => vi.advanceTimersByTime(2950))
    expect(screen.getByLabelText('Round countdown')).toHaveTextContent('1')
    expect(screen.getByText(/Secret article content/)).not.toBeVisible()
    act(() => vi.advanceTimersByTime(50))
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('0:00')
    expect(screen.getByText(/Secret article content/)).toBeVisible()
    act(() => screen.getByRole('button', { name: 'Follow this link' }).click())
    expect(sentMessages(socket).at(-1)).toMatchObject({ type: 'navigate', roundId: 'round-1' })
    act(() => vi.advanceTimersByTime(65_000))
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('1:05')
    act(() => socket.receive({ type: 'duel-interrupted', duelId: 'duel-1',
      reason: 'preparation-deadline', message: 'The Round could not prepare. No winner was assigned.' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Interruption. The Round could not prepare. No winner was assigned.')
    expect(screen.queryByLabelText('Elapsed time')).not.toBeInTheDocument()
  })

  it('presents connection state and creates a Lobby through the WebSocket', async () => {
    const user = userEvent.setup()
    const socket = renderApp()
    const createButton = screen.getByRole('button', { name: /create lobby/i })

    expect(screen.getByRole('status')).toHaveTextContent('Server connecting')
    expect(createButton).toBeDisabled()

    act(() => socket.open())
    expect(screen.getByRole('status')).toHaveTextContent('Server connected')

    await user.click(createButton)
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({ type: 'create-lobby', clientId })

    act(() => socket.receive({ type: 'lobby-state', lobby: hostLobby(clientId) }))
    expect(await screen.findByRole('heading', { name: 'Waiting for the duel' })).toBeInTheDocument()
    expect(screen.getByText('1 / 2 joined')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(sockets).toHaveLength(1)
  })

  it('joins a Lobby and presents rejected join notices', async () => {
    const user = userEvent.setup()
    const socket = renderApp()
    act(() => socket.open())

    await user.type(screen.getByLabelText('Lobby code'), '7g8kz')
    await user.click(screen.getByRole('button', { name: /join lobby/i }))
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({
      type: 'join-lobby',
      clientId,
      lobbyCode: '7G8KZ',
    })

    act(() => socket.receive({ type: 'lobby-error', message: 'Lobby not found' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Lobby not found')
    expect(screen.getByRole('button', { name: /join lobby/i })).toBeEnabled()
  })

  it('projects readiness and exposes start control only to a ready Host', async () => {
    const user = userEvent.setup()
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    expect(sentMessages(socket)).toContainEqual({
      type: 'join-lobby',
      clientId,
      lobbyCode: '7G8KZ',
    })

    act(() => socket.receive({
      type: 'lobby-state',
      lobby: {
        ...hostLobby(clientId),
        members: [
          hostLobby(clientId).members[0],
          { id: 'opponent-id', name: 'Opponent', role: 'opponent', connected: true, ready: false },
        ],
      },
    }))

    const startButton = screen.getByRole('button', { name: 'Start duel' })
    expect(startButton).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'I’m ready' }))
    expect(sentMessages(socket)).toContainEqual({ type: 'set-ready', ready: true })

    act(() => socket.receive({
      type: 'lobby-state',
      lobby: {
        ...hostLobby(clientId),
        members: [
          { ...hostLobby(clientId).members[0], ready: true },
          { id: 'opponent-id', name: 'Opponent', role: 'opponent', connected: true, ready: true },
        ],
      },
    }))

    expect(screen.getByText('Both players are ready.')).toBeInTheDocument()
    expect(startButton).toBeEnabled()
    await user.click(startButton)
    expect(sentMessages(socket)).toContainEqual({ type: 'start-duel' })

    act(() => socket.receive({
      type: 'duel-state',
      duel: {
        id: 'duel-1',
        phase: 'preparing',
        serverNow: 100_000,
        round: {
          id: 'round-1',
          number: 1,
          prompt: {
            id: 'fixture-first',
            start: { pageId: 1001, title: 'Fixture Start One' },
            target: { pageId: 1002, title: 'Fixture Target One' },
          },
        },
        self: {
          id: clientId,
          name: 'host',
          role: 'host',
          hp: 100,
          path: [{ pageId: 1001, title: 'Fixture Start One' }],
          clicks: 0,
        },
        opponent: {
          clicks: 0, connected: true,
          id: 'opponent-id',
          name: 'Opponent',
          role: 'opponent',
          hp: 100,
        },
      },
    }))

    expect(await screen.findByRole('heading', { name: 'Preparing the duel' })).toBeInTheDocument()
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getAllByText('100 HP')).toHaveLength(2)
    expect(screen.getAllByText('0 clicks')).toHaveLength(2)
    expect(screen.queryByText('Fixture Start One')).not.toBeInTheDocument()
    expect(screen.queryByText('Fixture Target One')).not.toBeInTheDocument()

    act(() => socket.receive({
      type: 'duel-forfeited',
      duelId: 'duel-1',
      winnerId: clientId,
      reason: 'player-disconnected',
      message: 'Your opponent disconnected. The Duel ended by Forfeit.',
    }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your opponent disconnected. The Duel ended by Forfeit.',
      )
    })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
  })

  it('shows opponent projections without Host controls', () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({
      type: 'lobby-state',
      lobby: {
        code: '7G8KZ',
        members: [
          { id: 'host-id', name: 'host', role: 'host', connected: true, ready: true },
          { id: clientId, name: 'Opponent', role: 'opponent', connected: true, ready: false },
        ],
      },
    }))

    expect(screen.queryByRole('button', { name: 'Start duel' })).not.toBeInTheDocument()
    expect(screen.getByText('The host starts the duel.')).toBeInTheDocument()
    expect(screen.getByText('Ready when you are.')).toBeInTheDocument()
  })

  it('returns home with a terminal notice when the Lobby closes', async () => {
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'lobby-state', lobby: hostLobby(clientId) }))
    act(() => socket.receive({
      type: 'lobby-closed',
      message: 'The other player left. The lobby has been closed.',
    }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Lobby closed. The other player left. The lobby has been closed.',
      )
    })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
  })

  it('leaves a Lobby explicitly and returns home', async () => {
    const user = userEvent.setup()
    const socket = renderApp('/lobby/7G8KZ')
    act(() => socket.open())
    const clientId = sentClientId(socket)
    act(() => socket.receive({ type: 'lobby-state', lobby: hostLobby(clientId) }))

    await user.click(screen.getByRole('button', { name: 'Leave lobby' }))

    expect(sentMessages(socket)).toContainEqual({ type: 'leave-lobby' })
    expect(screen.getByRole('heading', { name: 'Create or join a duel' })).toBeInTheDocument()
  })

  it('presents a disconnected WebSocket state', () => {
    const socket = renderApp()
    act(() => socket.open())
    act(() => socket.close())

    expect(screen.getByText('Server disconnected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create lobby/i })).toBeDisabled()
  })
})
